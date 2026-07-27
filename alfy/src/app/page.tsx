"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ホーム — 仕様書 §3-1
export default function HomePage() {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinInput, setJoinInput] = useState("");

  const goJoin = () => {
    const input = joinInput.trim();
    if (!input) return;
    // URLが貼られたらコード部分を抽出、コード単体ならそのまま
    const m = input.match(/\/e\/([a-z0-9]+)/i);
    const code = m ? m[1] : input;
    router.push(`/e/${encodeURIComponent(code)}`);
  };

  return (
    <main className="container">
      <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
        <h1 style={{ fontSize: 26 }}>日程調整を、スマートに。</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          AI秘書のAlfyくんが、日程調整をお手伝いします。
        </p>
      </div>

      <div className="stack mt-2">
        <Link href="/new" className="btn btn-primary">
          日程調整をつくる
        </Link>
        <button className="btn btn-outline" onClick={() => setJoinOpen((v) => !v)}>
          回答する(URLをお持ちの方)
        </button>
        {joinOpen && (
          <div className="card">
            <label className="field-label" htmlFor="join-input">
              受け取ったURL または コードを入力
            </label>
            <input
              id="join-input"
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="例) https://…/e/abc12345"
            />
            <div className="mt-2">
              <button className="btn btn-gold" onClick={goJoin}>
                回答ページへ
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card mt-2">
        <h2 style={{ fontSize: 17, marginBottom: 8 }}>Alfyのお約束</h2>
        <ol style={{ paddingLeft: 20, fontSize: 14 }}>
          <li>回答者は登録・アプリ不要。URLを開くだけ。</li>
          <li>データは確定・締切から30日で自動削除。</li>
          <li>運営は皆さまの内容を閲覧しません。</li>
        </ol>
      </div>
    </main>
  );
}
