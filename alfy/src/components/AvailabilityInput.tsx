"use client";

import { useEffect, useRef, useState } from "react";
import { processImageFile } from "@/lib/imageProcess";
import type { StoredImage } from "@/lib/imageStore";

// 自由文テキスト + 音声入力(Web Speech API) + 写真アップロード(複数枚・上限5)
// — 仕様書 §3-4, §3-7 / 追加要件B

export const MAX_IMAGES = 5;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function AvailabilityInput(props: {
  text: string;
  onTextChange: (text: string) => void;
  images: StoredImage[];
  onImagesChange: (images: StoredImage[]) => void;
  placeholder: string;
}) {
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSpeechSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        props.onTextChange(props.text ? `${props.text}\n${transcript}` : transcript);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  // 追加選択分は既存リストに積み増す(置き換えない)。6枚目以降は選ばせない。
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (files.length === 0) return;

    const errors: string[] = [];
    const room = MAX_IMAGES - props.images.length;
    if (room <= 0) {
      setImageErrors([`写真は${MAX_IMAGES}枚までです`]);
      return;
    }
    if (files.length > room) {
      errors.push(`写真は${MAX_IMAGES}枚までです(${room}枚だけ追加しました)`);
    }

    setProcessing(true);
    const added: StoredImage[] = [];
    const targets = files.slice(0, room);
    for (let i = 0; i < targets.length; i++) {
      try {
        added.push(await processImageFile(targets[i]));
      } catch {
        // 1枚失敗しても全体を落とさず残りで続行(要件B-6)
        errors.push(`${props.images.length + i + 1}枚目が読み取れませんでした`);
      }
    }
    setProcessing(false);
    if (added.length > 0) props.onImagesChange([...props.images, ...added]);
    setImageErrors(errors);
  };

  const removeImage = (index: number) => {
    props.onImagesChange(props.images.filter((_, i) => i !== index));
    setImageErrors([]);
  };

  return (
    <div>
      <textarea
        value={props.text}
        onChange={(e) => props.onTextChange(e.target.value)}
        placeholder={props.placeholder}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {speechSupported && (
          <button type="button" className="btn btn-outline btn-small" onClick={toggleVoice}>
            {listening ? "■ 停止" : "🎤 音声で入力"}
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={() => fileRef.current?.click()}
          disabled={processing || props.images.length >= MAX_IMAGES}
        >
          {processing
            ? "写真を処理中…"
            : `📷 写真から読み取る(${props.images.length}/${MAX_IMAGES})`}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>
      {props.images.map((img, i) => (
        <div
          key={`${img.name}-${i}`}
          className="info-box"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📷 {i + 1}枚目: {img.name}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => removeImage(i)}
            aria-label={`${i + 1}枚目の写真を削除`}
          >
            削除
          </button>
        </div>
      ))}
      {imageErrors.map((msg, i) => (
        <div className="error-box" key={i}>
          {msg}
        </div>
      ))}
    </div>
  );
}
