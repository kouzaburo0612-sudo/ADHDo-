"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AvailabilityInput, { ImagePayload } from "@/components/AvailabilityInput";
import { slotLabel, formatDateJaLong, formatTime } from "@/lib/jst";

// 回答ページ(参加者・登録不要)+ 確定表示 — 仕様書 §3-7, §3-9
type Slot = { id: string; date: string; start_time: string | null; end_time: string | null };
type EventInfo = {
  code: string;
  title: string;
  durationMinutes: number | null;
  deadline: string | null;
  status: string;
  confirmedSlotId: string | null;
};
type Answer = "yes" | "maybe" | "no";

const MARKS: { value: Answer; label: string; cls: string }[] = [
  { value: "yes", label: "○", cls: "sel-yes" },
  { value: "maybe", label: "△", cls: "sel-maybe" },
  { value: "no", label: "×", cls: "sel-no" },
];

export default function RespondPage() {
  const params = useParams<{ code: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // 回答フォーム
  const [proxyMode, setProxyMode] = useState(false);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [proxyLastName, setProxyLastName] = useState("");
  const [proxyFirstName, setProxyFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [aiText, setAiText] = useState("");
  const [aiImage, setAiImage] = useState<ImagePayload>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${params.code}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setEvent(data.event);
      setSlots(data.slots);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.code]);

  useEffect(() => {
    load();
  }, [load]);

  const setAnswer = (slotId: string, answer: Answer) => {
    setAnswers((prev) => ({ ...prev, [slotId]: answer }));
  };

  const aiFill = async () => {
    setError(null);
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: params.code,
          freeText: aiText,
          imageBase64: aiImage?.base64,
          imageMediaType: aiImage?.mediaType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "自動判定に失敗しました");
        return;
      }
      setAnswers(data.answers);
      setAiFilled(true);
    } catch {
      setError("通信に失敗しました。手動で○△×を選んでください。");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!lastName.trim()) {
      setError(proxyMode ? "本人の姓を入力してください" : "姓を入力してください");
      return;
    }
    if (proxyMode && !proxyLastName.trim()) {
      setError("代理人の姓を入力してください");
      return;
    }
    const answered = Object.keys(answers).length;
    if (answered < slots.length) {
      setError("すべての候補に○△×を選んでください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${params.code}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          email: email.trim(),
          proxyLastName: proxyMode ? proxyLastName.trim() : "",
          proxyFirstName: proxyMode ? proxyFirstName.trim() : "",
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました");
        return;
      }
      setSubmitted(true);
      window.scrollTo(0, 0);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
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
        <div className="error-box mt-2">
          イベントが見つかりません。URLをご確認ください(30日経過したイベントは自動削除されます)。
        </div>
      </main>
    );
  }

  // ===== 確定済み表示 — 仕様書 §3-9 =====
  if (event.status === "confirmed" && event.confirmedSlotId) {
    const slot = slots.find((s) => s.id === event.confirmedSlotId);
    const lineText = slot
      ? `【${event.title}】\n日程が決まりました!\n${formatDateJaLong(slot.date)}${slot.start_time ? ` ${formatTime(slot.start_time)}〜${formatTime(slot.end_time)}` : "(終日)"}\nよろしくお願いします。`
      : "";
    const copyLine = async () => {
      try {
        await navigator.clipboard.writeText(lineText);
        setCopiedLine(true);
        setTimeout(() => setCopiedLine(false), 2000);
      } catch {
        /* noop */
      }
    };
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

        {lineText && (
          <div className="card" style={{ marginTop: 8 }}>
            <label className="field-label">LINE用の確定文面</label>
            <textarea readOnly value={lineText} style={{ minHeight: 90 }} />
            <div className="stack mt-2">
              <a className="btn btn-primary" href={`/api/events/${event.code}/ics`}>
                📅 自分のカレンダーに追加(.ics)
              </a>
              <button className="btn btn-outline" onClick={copyLine}>
                {copiedLine ? "コピーしました ✓" : "LINE確定文面をコピー"}
              </button>
            </div>
          </div>
        )}

        <p className="muted" style={{ textAlign: "center" }}>
          このイベントのデータは30日後に自動削除されます。
        </p>
      </main>
    );
  }

  // ===== 回答完了 =====
  if (submitted) {
    return (
      <main className="container">
        <div className="success-box mt-2" style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>回答を受け付けました</h1>
          <p style={{ fontSize: 14 }}>
            ご協力ありがとうございます。日程が確定したらこのページでお知らせします。
          </p>
        </div>
        {email.trim() && (
          <p className="muted" style={{ textAlign: "center" }}>
            確定時にはメールでもお知らせします。
          </p>
        )}
      </main>
    );
  }

  // ===== 回答フォーム =====
  return (
    <main className="container">
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>{event.title}</h1>
      <p className="muted">
        ○△×で回答してください(登録不要)
        {event.deadline && ` — 締切: ${event.deadline}`}
      </p>

      <div className="card mt-2">
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${!proxyMode ? "selected" : ""}`}
            onClick={() => setProxyMode(false)}
          >
            自分の分を回答
          </button>
          <button
            type="button"
            className={`chip ${proxyMode ? "selected" : ""}`}
            onClick={() => setProxyMode(true)}
          >
            代理で回答
          </button>
        </div>

        <label className="field-label">
          {proxyMode ? "本人の名前" : "名前"}
          <span className="req">姓は必須</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="姓"
            aria-label={proxyMode ? "本人の姓" : "姓"}
          />
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="名(任意)"
            aria-label={proxyMode ? "本人の名" : "名"}
          />
        </div>

        {proxyMode && (
          <>
            <label className="field-label">
              代理人(あなた)の名前<span className="req">姓は必須</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={proxyLastName}
                onChange={(e) => setProxyLastName(e.target.value)}
                placeholder="姓"
                aria-label="代理人の姓"
              />
              <input
                type="text"
                value={proxyFirstName}
                onChange={(e) => setProxyFirstName(e.target.value)}
                placeholder="名(任意)"
                aria-label="代理人の名"
              />
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>AIで○△×を自動入力</h2>
        <p className="muted" style={{ marginBottom: 8 }}>
          予定をそのまま書く(または話す・写真を撮る)と、Alfyくんが○△×を自動でつけます。
        </p>
        <AvailabilityInput
          text={aiText}
          onTextChange={setAiText}
          image={aiImage}
          onImageChange={setAiImage}
          placeholder="例) 火曜は終日NG。27日は15時まで会議です"
        />
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={aiFill}
            disabled={aiLoading}
          >
            {aiLoading ? "判定中…" : "自動で○△×にする"}
          </button>
        </div>
        {aiFilled && (
          <div className="info-box">
            AIが○△×を入力しました。内容をご確認のうえ提出してください。
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>候補日時</h2>
        {slots.map((slot) => (
          <div className="answer-row" key={slot.id}>
            <span className="answer-label">{slotLabel(slot)}</span>
            <span className="answer-btns">
              {MARKS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`ans-btn ${answers[slot.id] === m.value ? m.cls : ""}`}
                  onClick={() => setAnswer(slot.id, m.value)}
                  aria-label={`${slotLabel(slot)} に ${m.label}`}
                >
                  {m.label}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <label className="field-label" htmlFor="email">
          メールアドレス<span className="opt">任意 — 確定通知・リマインドを受け取る</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="例) alfy@example.com"
        />
      </div>

      {error && <div className="error-box">{error}</div>}

      <button className="btn btn-primary" onClick={submit} disabled={submitting}>
        {submitting ? (
          <>
            <span className="spinner" /> 送信しています…
          </>
        ) : (
          "回答を送信"
        )}
      </button>
    </main>
  );
}
