"use client";

import Link from "next/link";

// Googleカレンダー連携 — v1では画面のみ・ボタンは「準備中」(仕様書 §3-3)
// v1.5でOAuth実装(free/busyのみ取得、予定タイトルは取得しない)予定
export default function GoogleLinkPage() {
  return (
    <main className="container">
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>空き時間の取り込み</h1>
      <p className="muted">Googleカレンダーから自動で取り込むこともできます(準備中)</p>

      <div className="card mt-2" style={{ textAlign: "center" }}>
        <p style={{ fontSize: 15, marginBottom: 12 }}>
          Googleカレンダー連携は現在準備中です。
          <br />
          もうしばらくお待ちください。
        </p>
        <button className="btn btn-outline" disabled>
          Googleカレンダーと連携(準備中)
        </button>
      </div>

      <Link href="/new/availability" className="btn btn-primary">
        手書き・テキストで入力する
      </Link>
    </main>
  );
}
