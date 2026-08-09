"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AvailabilityInput from "@/components/AvailabilityInput";
import { upsertMyEvent } from "@/lib/myEvents";
import { useDraft, DRAFT_KEYS } from "@/lib/useDraft";
import type { StoredImage } from "@/lib/imageStore";
import { slotLabel, formatDateJaLong, formatTime } from "@/lib/jst";

// 回答ページ(参加者・登録不要)+ 確定表示 — 仕様書 §3-7, §3-9
// 追加要件B(写真複数枚)・C-3(回答途中の入力保持: イベントコード単位)
type Slot = { id: string; date: string; start_time: string | null; end_time: string | null };
type Participant = {
  id: string;
  last_name: string;
  first_name: string | null;
  proxy_last_name: string | null;
  proxy_first_name: string | null;
  priority: "required" | "preferred" | null;
};

// 重要度の表示マーク(★必須 / ☆できれば)
const PRIORITY_MARK: Record<string, string> = { required: "★", preferred: "☆" };
type ResponseRow = { slot_id: string; participant_id: string; answer: string };

const MARK_VIEW: Record<string, { label: string; cls: string }> = {
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
type EventInfo = {
  code: string;
  title: string;
  durationMinutes: number | null;
  deadline: string | null;
  memo: string | null;
  status: string;
  confirmedSlotId: string | null;
};
type Answer = "yes" | "maybe" | "no";

const MARKS: { value: Answer; label: string; cls: string }[] = [
  { value: "yes", label: "○", cls: "sel-yes" },
  { value: "maybe", label: "△", cls: "sel-maybe" },
  { value: "no", label: "×", cls: "sel-no" },
];

type RespondDraft = {
  proxyMode: boolean;
  lastName: string;
  firstName: string;
  proxyLastName: string;
  proxyFirstName: string;
  email: string;
  answers: Record<string, Answer>;
  aiText: string;
};

const INITIAL_RESPOND: RespondDraft = {
  proxyMode: false,
  lastName: "",
  firstName: "",
  proxyLastName: "",
  proxyFirstName: "",
  email: "",
  answers: {},
  aiText: "",
};

export default function RespondPage() {
  const params = useParams<{ code: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // 回答途中の入力を保持(戻る・リロードでも消えない — 要件C-3)
  const { value: form, setValue: setForm, clear: clearForm } = useDraft<RespondDraft>(
    DRAFT_KEYS.respond(params.code),
    INITIAL_RESPOND
  );
  const patch = (p: Partial<RespondDraft>) => setForm((prev) => ({ ...prev, ...p }));

  const [aiImages, setAiImages] = useState<StoredImage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);
  // iPhoneでアプリ外(Safari/LINE内ブラウザ)で開いている場合は「アプリで開く」を出す
  const [showOpenInApp, setShowOpenInApp] = useState(false);
  useEffect(() => {
    const w = window as unknown as { Capacitor?: unknown };
    setShowOpenInApp(/iPhone|iPad|iPod/.test(navigator.userAgent) && !w.Capacitor);
  }, [params.code]);

  // 確定・取り消し(調整さん方式: URLを知っている人なら誰でも操作可能)
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copiedRemind, setCopiedRemind] = useState(false);

  // 回答修正(調整さん方式: 回答表の名前タップで誰でも修正可能)
  const [editingId, setEditingId] = useState<string | null>(null);
  // 自分がこの端末から回答した参加者IDを記憶 → 「自分の回答を修正」導線に使う
  const [myPid, setMyPid] = useState<string | null>(null);
  useEffect(() => {
    setMyPid(localStorage.getItem(`alfy_pid_${params.code}`));
  }, [params.code]);
  // 重要度の保存中表示
  const [savingPriority, setSavingPriority] = useState<string | null>(null);

  const startEdit = (p: Participant) => {
    const answers: Record<string, Answer> = {};
    responses.forEach((r) => {
      if (
        r.participant_id === p.id &&
        (r.answer === "yes" || r.answer === "maybe" || r.answer === "no")
      ) {
        answers[r.slot_id] = r.answer;
      }
    });
    setForm(() => ({
      ...INITIAL_RESPOND,
      proxyMode: !!p.proxy_last_name,
      lastName: p.last_name,
      firstName: p.first_name ?? "",
      proxyLastName: p.proxy_last_name ?? "",
      proxyFirstName: p.proxy_first_name ?? "",
      answers,
    }));
    setEditingId(p.id);
    setSubmitted(false);
    setError(null);
    window.scrollTo(0, 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    clearForm();
  };

  const setPriority = async (
    participantId: string,
    priority: "required" | "preferred" | null
  ) => {
    setError(null);
    setSavingPriority(participantId);
    try {
      const res = await fetch(`/api/events/${params.code}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, priority }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "重要度を保存できませんでした");
        return;
      }
      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, priority } : p))
      );
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSavingPriority(null);
    }
  };

  const confirmSlot = async (slotId: string) => {
    if (
      !window.confirm(
        "この日程で確定します。全員に確定として表示され、メール登録者には通知が送られます。よろしいですか?"
      )
    )
      return;
    setError(null);
    setConfirming(slotId);
    try {
      const res = await fetch(`/api/events/${params.code}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
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

  const cancelConfirm = async () => {
    if (!window.confirm("確定を取り消して、募集中に戻しますか?")) return;
    try {
      const res = await fetch(`/api/events/${params.code}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      });
      if (res.ok) {
        setSubmitted(false);
        await load();
      }
    } catch {
      /* 画面はそのまま */
    }
  };

  // みんなの回答状況(調整さん風マトリクス・閲覧用)
  const answerMap = new Map(
    responses.map((r) => [`${r.slot_id}:${r.participant_id}`, r.answer])
  );
  const canEditAnswers = event?.status === "open";
  const matrixCard = participants.length > 0 && (
    <div className="card">
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>
        みんなの回答状況({participants.length}名)
      </h2>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="slot-col">候補</th>
              {participants.map((p) => (
                <th key={p.id}>
                  {canEditAnswers ? (
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        color: "inherit",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                        cursor: "pointer",
                      }}
                    >
                      {p.priority ? PRIORITY_MARK[p.priority] : ""}
                      {participantLabel(p)}
                    </button>
                  ) : (
                    <>
                      {p.priority ? PRIORITY_MARK[p.priority] : ""}
                      {participantLabel(p)}
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const allYes = participants.every(
                (p) => answerMap.get(`${slot.id}:${p.id}`) === "yes"
              );
              return (
                <tr key={slot.id} className={allYes ? "all-yes" : ""}>
                  <th className="slot-col">
                    {slotLabel(slot)}
                    {allYes && <span className="badge-all-yes">全員○</span>}
                  </th>
                  {participants.map((p) => {
                    const a = answerMap.get(`${slot.id}:${p.id}`);
                    const m = a ? MARK_VIEW[a] : null;
                    return (
                      <td key={p.id} className={m?.cls ?? ""}>
                        {m?.label ?? "−"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEditAnswers && (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          名前をタップすると、その人の回答を修正できます。
        </p>
      )}
    </div>
  );

  const openInAppLink = showOpenInApp && (
    <p style={{ textAlign: "center", margin: "8px 0 0" }}>
      <a href={`alfy://e/${params.code}`} className="muted" style={{ fontSize: 13 }}>
        📱 Alfyアプリをお持ちの方はこちら(アプリで開く)
      </a>
    </p>
  );

  // 幹事メニュー(誰でも使える — 調整さん方式)
  const eventUrl =
    typeof window !== "undefined" ? `${window.location.origin}/e/${params.code}` : "";
  const remindText = event
    ? `【${event.title}】\n日程調整の回答がまだの方はお願いします🙏\n${event.deadline ? `締切: ${event.deadline}\n` : ""}回答はこちら(登録不要):\n${eventUrl}`
    : "";
  const copyRemind = async () => {
    try {
      await navigator.clipboard.writeText(remindText);
      setCopiedRemind(true);
      setTimeout(() => setCopiedRemind(false), 2000);
    } catch {
      /* noop */
    }
  };
  // 重要度を加味した候補の並び替え(必須×がいる候補は減点して下へ)
  const requiredPeople = participants.filter((p) => p.priority === "required");
  const rankedSlots = slots
    .map((slot) => {
      const ans = (p: Participant) => answerMap.get(`${slot.id}:${p.id}`);
      const allYes =
        participants.length > 0 && participants.every((p) => ans(p) === "yes");
      const reqNo = requiredPeople.filter((p) => ans(p) === "no");
      const reqAllYes =
        requiredPeople.length > 0 && requiredPeople.every((p) => ans(p) === "yes");
      let score = participants.filter((p) => ans(p) === "yes").length;
      participants.forEach((p) => {
        const a = ans(p);
        if (p.priority === "required") {
          if (a === "yes") score += 100;
          else if (a === "no") score -= 1000;
        } else if (p.priority === "preferred") {
          if (a === "yes") score += 10;
          else if (a === "no") score -= 10;
        }
      });
      return { slot, allYes, reqNo, reqAllYes, score };
    })
    .sort((a, b) => b.score - a.score);

  const PRIORITY_CHOICES: { value: "required" | "preferred" | null; label: string }[] = [
    { value: "required", label: "★必須" },
    { value: "preferred", label: "☆できれば" },
    { value: null, label: "ふつう" },
  ];

  const organizerMenu = participants.length > 0 && (
    <details className="card">
      <summary style={{ cursor: "pointer", fontSize: 16, fontWeight: 600 }}>
        📅 日程を確定する(幹事メニュー)
      </summary>

      <h3 style={{ fontSize: 14, margin: "12px 0 4px" }}>参加者の重要度</h3>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        「絶対来てほしい人」を★必須にすると、その人が○の候補が上に、×の候補は下に並びます。
      </p>
      {participants.map((p) => (
        <div className="answer-row" key={p.id}>
          <span className="answer-label">{participantLabel(p)}</span>
          <span style={{ display: "flex", gap: 6 }}>
            {PRIORITY_CHOICES.map((c) => (
              <button
                key={c.label}
                type="button"
                className={`chip ${(p.priority ?? null) === c.value ? "selected" : ""}`}
                disabled={savingPriority === p.id}
                onClick={() => setPriority(p.id, c.value)}
              >
                {c.label}
              </button>
            ))}
          </span>
        </div>
      ))}

      <h3 style={{ fontSize: 14, margin: "16px 0 4px" }}>日程を確定する</h3>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        確定すると全員にこの日程が表示され、メール登録者には通知が届きます。
      </p>
      <div className="stack">
        {rankedSlots.map(({ slot, allYes, reqNo, reqAllYes }) => (
          <div key={slot.id}>
            <button
              className={`btn ${allYes || reqAllYes ? "btn-gold" : "btn-outline"}`}
              style={{ width: "100%" }}
              onClick={() => confirmSlot(slot.id)}
              disabled={confirming !== null}
            >
              {confirming === slot.id
                ? "確定中…"
                : `${slotLabel(slot)} で確定する${
                    allYes ? "(全員○)" : reqAllYes ? "(必須全員○)" : ""
                  }`}
            </button>
            {reqNo.length > 0 && (
              <p style={{ fontSize: 12, margin: "4px 0 0", color: "#b3261e" }}>
                ⚠ 必須の{reqNo.map((p) => p.last_name).join("さん・")}さんが×です
              </p>
            )}
          </div>
        ))}
        <button className="btn btn-outline" onClick={copyRemind}>
          {copiedRemind ? "コピーしました ✓" : "LINE催促文面をコピー"}
        </button>
      </div>
    </details>
  );

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
      setParticipants(data.participants ?? []);
      setResponses(data.responses ?? []);
      // 開いただけでホームの一覧に載せる(幹事登録済みなら上書きしない)
      if (data.event?.title) {
        upsertMyEvent({
          code: params.code,
          title: data.event.title,
          role: "participant",
        });
      }
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
    setForm((prev) => ({ ...prev, answers: { ...prev.answers, [slotId]: answer } }));
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
          freeText: form.aiText,
          images: aiImages.map((i) => ({ base64: i.base64, mediaType: i.mediaType })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "自動判定に失敗しました");
        return;
      }
      patch({ answers: data.answers });
      setAiFilled(true);
    } catch {
      setError("通信に失敗しました。手動で○△×を選んでください。");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!form.lastName.trim()) {
      setError(form.proxyMode ? "本人の姓を入力してください" : "姓を入力してください");
      return;
    }
    if (form.proxyMode && !form.proxyLastName.trim()) {
      setError("代理人の姓を入力してください");
      return;
    }
    const answered = Object.keys(form.answers).length;
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
          participantId: editingId ?? undefined,
          lastName: form.lastName.trim(),
          firstName: form.firstName.trim(),
          email: form.email.trim(),
          proxyLastName: form.proxyMode ? form.proxyLastName.trim() : "",
          proxyFirstName: form.proxyMode ? form.proxyFirstName.trim() : "",
          answers: form.answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました");
        return;
      }
      // 回答済みイベントとして端末に記憶(ホームの一覧に出す)
      if (event) {
        upsertMyEvent({ code: params.code, title: event.title, role: "participant" });
      }
      // 新規回答なら、この端末の回答者として記憶(「自分の回答を修正」導線に使う)
      if (!editingId && data.participantId) {
        localStorage.setItem(`alfy_pid_${params.code}`, data.participantId);
        setMyPid(data.participantId);
      }
      // 回答送信完了 → ドラフト破棄(要件C-4)+ 最新の回答状況を取得
      setEditingId(null);
      clearForm();
      await load();
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

        {matrixCard}

        <p className="muted" style={{ textAlign: "center" }}>
          このイベントのデータは30日後に自動削除されます。
        </p>
        <p style={{ textAlign: "center", marginTop: 8 }}>
          <button
            type="button"
            onClick={cancelConfirm}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 12,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            確定を取り消して募集中に戻す
          </button>
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
        {form.email.trim() && (
          <p className="muted" style={{ textAlign: "center" }}>
            確定時にはメールでもお知らせします。
          </p>
        )}
        {myPid && participants.some((p) => p.id === myPid) && (
          <div className="stack mt-2">
            <button
              className="btn btn-outline"
              onClick={() => {
                const me = participants.find((p) => p.id === myPid);
                if (me) startEdit(me);
              }}
            >
              自分の回答を修正する
            </button>
          </div>
        )}
        {matrixCard}
        {organizerMenu}
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

      {openInAppLink}

      {editingId && (
        <div className="info-box mt-2">
          ✏️ {form.lastName || "回答者"}さんの回答を修正しています
          <button
            type="button"
            onClick={cancelEdit}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 12,
              textDecoration: "underline",
              cursor: "pointer",
              marginLeft: 8,
            }}
          >
            修正をやめる
          </button>
        </div>
      )}

      {event.memo && (
        <div className="info-box mt-2" style={{ whiteSpace: "pre-line" }}>
          {event.memo}
        </div>
      )}

      <div className="card mt-2">
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${!form.proxyMode ? "selected" : ""}`}
            onClick={() => patch({ proxyMode: false })}
          >
            自分の分を回答
          </button>
          <button
            type="button"
            className={`chip ${form.proxyMode ? "selected" : ""}`}
            onClick={() => patch({ proxyMode: true })}
          >
            代理で回答
          </button>
        </div>

        <label className="field-label">
          {form.proxyMode ? "本人の名前" : "名前"}
          <span className="req">姓は必須</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => patch({ lastName: e.target.value })}
            placeholder="姓"
            aria-label={form.proxyMode ? "本人の姓" : "姓"}
          />
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => patch({ firstName: e.target.value })}
            placeholder="名(任意)"
            aria-label={form.proxyMode ? "本人の名" : "名"}
          />
        </div>

        {form.proxyMode && (
          <>
            <label className="field-label">
              代理人(あなた)の名前<span className="req">姓は必須</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={form.proxyLastName}
                onChange={(e) => patch({ proxyLastName: e.target.value })}
                placeholder="姓"
                aria-label="代理人の姓"
              />
              <input
                type="text"
                value={form.proxyFirstName}
                onChange={(e) => patch({ proxyFirstName: e.target.value })}
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
          text={form.aiText}
          onTextChange={(t) => patch({ aiText: t })}
          images={aiImages}
          onImagesChange={setAiImages}
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
                  className={`ans-btn ${form.answers[slot.id] === m.value ? m.cls : ""}`}
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

      {matrixCard}

      {organizerMenu}

      <div className="card">
        <label className="field-label" htmlFor="email">
          メールアドレス<span className="opt">任意 — 確定通知・リマインドを受け取る</span>
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => patch({ email: e.target.value })}
          placeholder="例) alfy@example.com"
        />
      </div>

      {error && <div className="error-box">{error}</div>}

      <button className="btn btn-primary" onClick={submit} disabled={submitting}>
        {submitting ? (
          <>
            <span className="spinner" /> 送信しています…
          </>
        ) : editingId ? (
          "回答を修正する"
        ) : (
          "回答を送信"
        )}
      </button>
    </main>
  );
}
