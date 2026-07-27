"use client";

import type { StoredImage } from "./imageStore";

// 写真の前処理(要件B-3)
// - JPEG/PNG/GIF/WebP はそのまま(小さければ)
// - HEIC(iPhone実機写真)や大きいファイルは canvas で JPEG に再エンコード
//   (長辺2000pxへリサイズ。VercelのAPIボディ上限対策も兼ねる)

const PASSTHROUGH_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const PASSTHROUGH_MAX_BYTES = 1_500_000; // これ以下ならそのまま送る
const MAX_LONG_EDGE = 2000;
const JPEG_QUALITY = 0.8;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function reencodeToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // HEICはSafariがネイティブでデコードできる
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("decode failed");
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 1ファイルを送信可能な形式に変換する。失敗時は例外(呼び出し側で1枚単位で処理)
export async function processImageFile(file: File): Promise<StoredImage> {
  const isImage =
    file.type.startsWith("image/") ||
    /\.(heic|heif|jpe?g|png|gif|webp)$/i.test(file.name);
  if (!isImage) {
    throw new Error("画像ファイルを選んでください");
  }

  let dataUrl: string;
  let mediaType: string;
  if (PASSTHROUGH_TYPES.includes(file.type) && file.size <= PASSTHROUGH_MAX_BYTES) {
    dataUrl = await readAsDataUrl(file);
    mediaType = file.type;
  } else {
    // HEIC / 大きいファイル → JPEGへ再エンコード
    dataUrl = await reencodeToJpeg(file);
    mediaType = "image/jpeg";
  }

  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64) throw new Error("読み取りに失敗しました");
  return { name: file.name, mediaType, base64 };
}
