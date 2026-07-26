"use client";

import { useEffect, useRef, useState } from "react";

// 自由文テキスト + 音声入力(Web Speech API) + 写真アップロード — 仕様書 §3-4, §3-7
export type ImagePayload = { base64: string; mediaType: string } | null;

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
  image: ImagePayload;
  onImageChange: (image: ImagePayload) => void;
  placeholder: string;
}) {
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
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

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      setImageError("JPEG / PNG / GIF / WebP の画像を選んでください");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setImageError("画像は4MB以下にしてください");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      props.onImageChange({ base64, mediaType: file.type });
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    props.onImageChange(null);
    setImageName(null);
    if (fileRef.current) fileRef.current.value = "";
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
        >
          📷 写真から読み取る
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>
      {imageName && (
        <div className="info-box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>📷 {imageName}</span>
          <button type="button" className="btn btn-outline btn-small" onClick={clearImage}>
            削除
          </button>
        </div>
      )}
      {imageError && <div className="error-box">{imageError}</div>}
    </div>
  );
}
