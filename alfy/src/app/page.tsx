"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMyEvents, removeMyEvent, MyEvent } from "@/lib/myEvents";
import { slotLabel } from "@/lib/jst";

// ホーム — イベント中心のハブ(幹事・参加者どちらのイベントも一覧表示)
type Slot = { id: string; date: string; start_time: string | null; end_time: string | null };
type EventDetail = { slots: Slot[]; status: string; title: string };

export default function HomePage() {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [details, setDetails] = useState<Record<string, EventDetail>>({});

  useEffect(() => {
    const list = getMyEvents();
    setMyEvents(list);
    // 各イベントの最新情報(候補チップ・確定状態)を取得。
    // 失敗しても記憶している情報でカードは表示する。404は削除済みとして一覧から外す。
    list.slice(0, 20).forEach(async (e) => {
      try {
        const res = await fetch(`/api/events/${e.code}`);
        if (res.status === 404) {
          removeMyEvent(e.code);
          setMyEvents(getMyEvents());
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setDetails((prev) => ({
          ...prev,
          [e.code]: {
            slots: data.slots ?? [],
            status: data.event?.status ?? "open",
            title: data.event?.title ?? e.title,
          },
        }));
      } catch {
        /* オフライン等 — 記憶情報のみで表示 */
      }
    });
  }, []);

  const forget = (code: string) => {
    if (!window.confirm("この一覧から削除しますか?(イベント自体は消えません)")) return;
    removeMyEvent(code);
    setMyEvents(getMyEvents());
  };

  const goJoin = () => {
    const input = joinInput.trim();
    if (!input) return;
    const m = input.match(/\/e\/([a-z0-9]+)/i);
    const code = m ? m[1] : input;
    router.push(`/e/${encodeURIComponent(code)}`);
  };

  const cardHref = (e: MyEvent) =>
    e.role === "organizer" && e.adminToken
      ? `/e/${e.code}/admin?token=${encodeURIComponent(e.adminToken)}`
      : `/e/${e.code}`;

  return (
    <main className="container">
      <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.png"
          alt="Alfy — 日程調整を、スマートに。"
          style={{ maxWidth: 240, width: "64%", height: "auto" }}
        />
      </div>

      <div className="stack mt-2">
        <Link href="/new" className="btn btn-primary">
          + 日程調整をつくる
        </Link>
      </div>

      {myEvents.length > 0 && (
        <>
          <h2 style={{ fontSize: 17, margin: "20px 0 8px" }}>イベント</h2>
          {myEvents.map((e) => {
            const d = details[e.code];
            const slots = d?.slots ?? [];
            return (
              <div className="event-card" key={e.code}>
                <Link href={cardHref(e)} className="event-card-link">
                  <div className="event-card-head">
                    <span className="event-title serif">
                      {d?.title || e.title || e.code}
                    </span>
                    <span className="event-badges">
                      {e.role === "organizer" && (
                        <span className="badge badge-navy">幹事</span>
                      )}
                      {d?.status === "confirmed" && (
                        <span className="badge badge-green">決定</span>
                      )}
                    </span>
                  </div>
                  {slots.length > 0 && (
                    <div className="slot-chips">
                      {slots.slice(0, 4).map((s) => (
                        <span className="slot-chip" key={s.id}>
                          {slotLabel(s)}
                        </span>
                      ))}
                      {slots.length > 4 && (
                        <span className="slot-chip-more">他{slots.length - 4}件</span>
                      )}
                    </div>
                  )}
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {e.role === "organizer"
                      ? "タップで回答状況・確定へ"
                      : "タップで回答ページへ"}
                  </div>
                </Link>
                <button
                  type="button"
                  className="event-remove"
                  onClick={() => forget(e.code)}
                  aria-label={`${e.title || e.code} を一覧から削除`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </>
      )}

      <div className="stack mt-2">
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
