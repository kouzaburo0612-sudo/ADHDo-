"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// 共有ページ — 仕様書 §3-6(調整さん方式: URLはひとつだけ)
export default function SharePage() {
  const params = useParams<{ code: string }>();
  const [copied, setCopied] = useState(false);

  const eventUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/e/${params.code}`;
  }, [params.code]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボード非対応環境では選択コピーしてもらう
    }
  };

  const lineShareUrl = `https://line.me/R/share?text=${encodeURIComponent(
    `日程調整のお願いです。こちらから○△×で回答してください(登録不要):\n${eventUrl}`
  )}`;

  return (
    <main className="container">
      <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
        <h1 style={{ fontSize: 22 }}>イベントをつくりました</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          このURLをメンバーに共有してください
        </p>
      </div>

      <div className="card mt-2">
        <label className="field-label">イベントURL</label>
        <input type="text" readOnly value={eventUrl} onFocus={(e) => e.target.select()} />
        <div className="stack mt-2">
          <a className="btn btn-primary" href={lineShareUrl} target="_blank" rel="noreferrer">
            LINEで送る
          </a>
          <button className="btn btn-outline" onClick={copyUrl}>
            {copied ? "コピーしました ✓" : "URLをコピー"}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          回答も、集計の確認も、日程の確定も、すべてこのURLひとつでできます。
        </p>
      </div>

      <div className="stack mt-2">
        <Link className="btn btn-gold" href={`/e/${params.code}`}>
          イベントページへ
        </Link>
      </div>
    </main>
  );
}
