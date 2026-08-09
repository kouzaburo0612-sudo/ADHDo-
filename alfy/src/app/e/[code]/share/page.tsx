"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

// 共有ページ — 仕様書 §3-6
export default function SharePage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const token = search.get("token");
  const [copied, setCopied] = useState<string | null>(null);

  const eventUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/e/${params.code}`;
  }, [params.code]);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
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
          回答URLをメンバーに共有してください
        </p>
      </div>

      <div className="card mt-2">
        <label className="field-label">回答URL</label>
        <input type="text" readOnly value={eventUrl} onFocus={(e) => e.target.select()} />
        <div className="stack mt-2">
          <a className="btn btn-primary" href={lineShareUrl} target="_blank" rel="noreferrer">
            LINEで送る
          </a>
          <button className="btn btn-outline" onClick={() => copyText("event", eventUrl)}>
            {copied === "event" ? "コピーしました ✓" : "URLをコピー"}
          </button>
        </div>
      </div>

      {token ? (
        <div className="card">
          <p className="muted" style={{ marginBottom: 8 }}>
            回答状況の確認・日程の確定はこちら(このURLは主催者専用です)
          </p>
          <Link
            className="btn btn-gold"
            href={`/e/${params.code}/admin?token=${encodeURIComponent(token)}`}
          >
            管理ページへ
          </Link>

          <label className="field-label" style={{ marginTop: 16 }}>
            管理用URL(あなた専用 — 必ず控えてください)
          </label>
          <input
            type="text"
            readOnly
            value={`${eventUrl}/admin?token=${token}`}
            onFocus={(e) => e.target.select()}
          />
          <div className="stack mt-2">
            <button
              className="btn btn-outline"
              onClick={() => copyText("admin", `${eventUrl}/admin?token=${token}`)}
            >
              {copied === "admin" ? "コピーしました ✓" : "管理URLをコピー"}
            </button>
            <a
              className="btn btn-outline"
              href={`https://line.me/R/share?text=${encodeURIComponent(
                `【Alfy管理用・自分メモ】このURLは他の人に送らないでください\n${eventUrl}/admin?token=${token}`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              LINEのKeepメモに送っておく(紛失防止)
            </a>
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            ※ 機種変更やアプリ入れ直しをしても、このURLさえあれば管理ページに入れます。
          </p>
        </div>
      ) : (
        <div className="info-box">
          管理用リンクはイベント作成時に発行されます。作成者の方は作成時のURLをご利用ください。
        </div>
      )}
    </main>
  );
}
