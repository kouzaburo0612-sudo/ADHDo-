"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { upsertMyEvent } from "@/lib/myEvents";
import { slotLabel, formatDateJaLong, formatTime } from "@/lib/jst";

// 管理(結果)ページ — 仕様書 §3-8
type Slot = { id: string; date: string; start_time: string | null; end_time: string | null };
type Participant = {
  id: string;
  last_name: string;
  first_name: string | null;
  proxy_last_name: string | null;
  proxy_first_name: string | null;
};
type ResponseRow = { slot_id: string; participant_id: string; answer: string };
type EventInfo = {
  code: string;
  title: string;
  deadline: string | null;
  status: string;
  confirmedSlotId: string | null;
  isAdmin: boolean;
};

const MARK: Record<string, { label: string; cls: string }> = {
  yes: { label: "○", cls: "mark-yes" },
  maybe: { label: "△", cls: "mark-maybe" },
  no: { label: "×", cls: "mark-no" },
};

function participantLabel(p: Participant): string {
  const name = p.first_name ? `${p.last_name} ${p.first_name}` : p.last_name;
  if (p.proxy_last_name) {
    const proxy = p.proxy_first_name
      ? `${p.proxy_last_name} ${p.proxy_first_name}`
      : p.proxy_last_name;
    return `${name}(代理: ${proxy})`;
  }
  return name;
}

export default function AdminPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const token = search.get("token") ?? "";

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/events/${params.code}?token=${encodeURIComponent(token)}`
      );
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setEvent(data.event);
      setSlots(data.slots);
      setParticipants(data.participants);
      setResponses(data.responses);
      // 有効な管理トークンで開けたら端末に記憶(次回ホームから戻れるように)
      if (data.event?.isAdmin && token) {
        upsertMyEvent({
          code: data.event.code,
          title: data.event.title,
          role: "organizer",
          adminToken: token,
        });
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.code, token]);

  useEffect(() => {
    load();
  }, [load]);

  const answerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of responses) {
      map.set(`${r.slot_id}:${r.participant_id}`, r.answer);
    }
    return map;
  }, [responses]);

  const allYesSlots = useMemo(() => {
    if (participants.length === 0) return new Set<string>();
    const set = new Set<string>();
    for (const slot of slots) {
      const allYes = participants.every(
        (p) => answerMap.get(`${slot.id}:${p.id}`) === "yes"
      );
      if (allYes) set.add(slot.id);
    }
    return set;
  }, [slots, participants, answerMap]);

  const eventUrl =
    typeof window !== "undefined" ? `${window.location.origin}/e/${params.code}` : "";

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* noop */
    }
  };

  const confirm = async (slotId: string) => {
    if (!window.confirm("この日程で確定します。よろしいですか?")) return;
    setError(null);
    setConfirming(slotId);
    try {
      const res = await fetch(`/api/events/${params.code}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slotId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "確定に失敗しました");
        return;
      }
      await load();
      window.scrollTo(0, 0);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setConfirming(null);
    }
  };

  if (loading) {
    return (
      <main className="container">
        <p className="muted mt-2">読み込み中…</p>
      </main>
    );
  }

  if (notFound || !event) {
    return (
      <main className="container">
        <div className="error-box mt-2">イベントが見つかりません。</div>
      </main>
    );
  }

  if (!event.isAdmin) {
    return (
      <main className="container">
        <div className="error-box mt-2">
          管理ページを表示する権限がありません。作成時に発行された管理用URL(token付き)からアクセスしてください。
        </div>
      </main>
    );
  }

  // ===== 確定済み =====
  if (event.status === "confirmed" && event.confirmedSlotId) {
    const slot = slots.find((s) => s.id === event.confirmedSlotId);
    const lineText = slot
      ? `【${event.title}】\n日程が決まりました!\n${formatDateJaLong(slot.date)}${slot.start_time ? ` ${formatTime(slot.start_time)}〜${formatTime(slot.end_time)}` : "(終日)"}\nよろしくお願いします。`
      : "";
    return (
      <main className="container">
        <div className="confirmed-hero">
          <h1>決まりました。</h1>
          {slot && (
            <div className="confirmed-date">
              {formatDateJaLong(slot.date)}
              {slot.start_time && (
                <>
                  <br />
                  {formatTime(slot.start_time)}〜{formatTime(slot.end_time)}
                </>
              )}
            </div>
          )}
          <p className="muted" style={{ marginTop: 8 }}>
            {event.title}
          </p>
        </div>

        <div className="success-box">
          メール登録済みの回答者には確定通知を自動送信しました。
        </div>

        <div className="card">
          <div className="stack">
            <a className="btn btn-primary" href={`/api/events/${event.code}/ics`}>
              📅 自分のカレンダーに追加(.ics)
            </a>
            <button className="btn btn-outline" onClick={() => copy("line", lineText)}>
              {copied === "line" ? "コピーしました ✓" : "LINE確定文面をコピー"}
            </button>
            <Link href="/new" className="btn btn-gold">
              新しい日程調整をつくる
            </Link>
          </div>
        </div>

        <p className="muted" style={{ textAlign: "center" }}>
          このイベントのデータは30日後に自動削除されます。
        </p>
      </main>
    );
  }

  // ===== 回答状況(調整さん風マトリクス) =====
  const remindText = `【${event.title}】\n日程調整の回答がまだの方はお願いします🙏\n${event.deadline ? `締切: ${event.deadline}\n` : ""}回答はこちら(登録不要):\n${eventUrl}`;

  return (
    <main className="container">
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>{event.title}</h1>
      <p className="muted">
        回答状況 — {participants.length}名回答済み
        {event.deadline && ` / 締切: ${event.deadline}`}
      </p>

      {participants.length === 0 ? (
        <div className="info-box mt-2">
          まだ回答がありません。回答URLをメンバーに共有してください。
        </div>
      ) : (
        <div className="card mt-2">
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th className="slot-col">候補</th>
                  {participants.map((p) => (
                    <th key={p.id}>{participantLabel(p)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const isAllYes = allYesSlots.has(slot.id);
                  return (
                    <tr key={slot.id} className={isAllYes ? "all-yes" : ""}>
                      <th className="slot-col">
                        {slotLabel(slot)}
                        {isAllYes && <span className="badge-all-yes">全員○</span>}
                      </th>
                      {participants.map((p) => {
                        const a = answerMap.get(`${slot.id}:${p.id}`);
                        const mark = a ? MARK[a] : null;
                        return (
                          <td key={p.id} className={mark?.cls ?? ""}>
                            {mark?.label ?? "−"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allYesSlots.size > 0 && (
        <div className="success-box">
          {slots
            .filter((s) => allYesSlots.has(s.id))
            .map((s) => slotLabel(s))
            .join(" / ")}{" "}
          は全員が○です。
        </div>
      )}

      {participants.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>日程を確定する</h2>
          <div className="stack">
            {slots.map((slot) => (
              <button
                key={slot.id}
                className={`btn ${allYesSlots.has(slot.id) ? "btn-gold" : "btn-outline"}`}
                onClick={() => confirm(slot.id)}
                disabled={confirming !== null}
              >
                {confirming === slot.id ? "確定中…" : `${slotLabel(slot)} で確定する`}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      <div className="card">
        <div className="stack">
          <button className="btn btn-outline" onClick={() => copy("remind", remindText)}>
            {copied === "remind" ? "コピーしました ✓" : "LINE催促文面をコピー"}
          </button>
          <button className="btn btn-outline" onClick={() => copy("url", eventUrl)}>
            {copied === "url" ? "コピーしました ✓" : "回答URLをコピー"}
          </button>
          <button className="btn btn-outline" onClick={load}>
            更新(最新の回答を取得)
          </button>
          <Link href="/new" className="btn btn-primary">
            新しい日程調整をつくる
          </Link>
        </div>
      </div>
    </main>
  );
}
