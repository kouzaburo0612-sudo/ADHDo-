"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AvailabilityInput from "@/components/AvailabilityInput";
import { EventDraft, loadDraft, clearDraft } from "@/lib/draft";
import { useDraft, DRAFT_KEYS } from "@/lib/useDraft";
import { StoredImage, saveImages, loadImages, clearImages } from "@/lib/imageStore";
import { formatDateJa, WEEKDAYS_JA } from "@/lib/jst";

// 作成 STEP2: 空き時間提出 → AI候補生成 → 確認 → 保存 — 仕様書 §3-4,5
// 追加要件B(写真複数枚)・C(入力保持: テキスト/候補はsessionStorage、写真はIndexedDB)
type Candidate = { date: string; start: string | null; end: string | null };

function candidateLabel(c: Candidate): string {
  if (!c.start) return `${formatDateJa(c.date)} 終日`;
  return `${formatDateJa(c.date)} ${c.start}〜${c.end ?? ""}`;
}

type Step2Draft = {
  text: string;
  candidates: Candidate[] | null;
};

export default function AvailabilityPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [draftMissing, setDraftMissing] = useState(false);
  const {
    value: step2,
    setValue: setStep2,
    clear: clearStep2,
    restored,
  } = useDraft<Step2Draft>(DRAFT_KEYS.step2, { text: "", candidates: null });
  const [images, setImagesState] = useState<StoredImage[]>([]);
  const imagesLoaded = useRef(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 手動追加フォーム
  const [addDate, setAddDate] = useState("");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");

  useEffect(() => {
    const d = loadDraft();
    if (!d) {
      setDraftMissing(true);
    } else {
      setDraft(d);
    }
    // 写真ドラフトをIndexedDBから復元(要件C-2)
    loadImages(DRAFT_KEYS.step2Images).then((imgs) => {
      imagesLoaded.current = true;
      if (imgs.length > 0) setImagesState(imgs);
    });
  }, []);

  const setImages = (imgs: StoredImage[]) => {
    setImagesState(imgs);
    if (imagesLoaded.current) saveImages(DRAFT_KEYS.step2Images, imgs);
  };

  const text = step2.text;
  const candidates = step2.candidates;
  const setText = (t: string) => setStep2((prev) => ({ ...prev, text: t }));
  const setCandidates = (c: Candidate[] | null) =>
    setStep2((prev) => ({ ...prev, candidates: c }));

  const generate = async () => {
    if (!draft) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeText: text,
          images: images.map((i) => ({ base64: i.base64, mediaType: i.mediaType })),
          durationMinutes: draft.durationMinutes,
          maxCandidates: draft.maxCandidates,
          periodFrom: draft.periodFrom,
          periodTo: draft.periodTo,
          timeFrom: draft.timeFrom,
          timeTo: draft.timeTo,
          ngWeekdays: draft.ngWeekdays ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "候補の生成に失敗しました");
        return;
      }
      if (!data.candidates || data.candidates.length === 0) {
        setError("候補が見つかりませんでした。入力内容を見直してください。");
        return;
      }
      setCandidates(data.candidates);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  const removeCandidate = (index: number) => {
    setCandidates(candidates ? candidates.filter((_, i) => i !== index) : null);
  };

  const addCandidate = () => {
    setError(null);
    if (!addDate) {
      setError("追加する日付を選んでください");
      return;
    }
    const isAllDay = draft?.durationMinutes == null;
    if (!isAllDay && (!addStart || !addEnd)) {
      setError("開始・終了時刻を入力してください");
      return;
    }
    const c: Candidate = isAllDay
      ? { date: addDate, start: null, end: null }
      : { date: addDate, start: addStart, end: addEnd };
    setCandidates([...(candidates ?? []), c]);
    setAddDate("");
    setAddStart("");
    setAddEnd("");
  };

  const clearAllDrafts = () => {
    clearDraft();
    clearStep2();
    sessionStorage.removeItem(DRAFT_KEYS.step1);
    clearImages(DRAFT_KEYS.step2Images);
  };

  // 明示破棄(要件C-4)
  const restart = () => {
    if (!window.confirm("入力内容をすべて消して最初からやり直しますか?")) return;
    clearAllDrafts();
    router.push("/new");
  };

  // 「確認をスキップして確定」してはならない — 必ず候補一覧の確認を挟む(仕様書 §3-5)
  const save = async () => {
    if (!draft || !candidates || candidates.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          durationMinutes: draft.durationMinutes,
          deadline: draft.deadline,
          periodFrom: draft.periodFrom,
          periodTo: draft.periodTo,
          timeFrom: draft.timeFrom,
          timeTo: draft.timeTo,
          ngWeekdays: draft.ngWeekdays ?? [],
          slots: candidates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      // イベント発行完了 → ドラフト破棄(要件C-4)
      clearAllDrafts();
      router.push(`/e/${data.code}/share?token=${encodeURIComponent(data.adminToken)}`);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  // 候補確認画面の説明文(要件A-4)
  const summaryText = (() => {
    if (!draft || !candidates) return "";
    const durationPart =
      draft.durationMinutes == null ? "終日" : `所要${draft.durationMinutes}分`;
    const ng = draft.ngWeekdays ?? [];
    const ngPart =
      ng.length > 0
        ? `・${ng.map((d) => `${WEEKDAYS_JA[d]}曜日`).join("・")}を除いて`
        : "・";
    return `${durationPart}${ngPart}候補を${candidates.length}件つくりました`;
  })();

  if (draftMissing) {
    return (
      <main className="container">
        <div className="info-box mt-2">
          イベント情報が見つかりません。最初からやり直してください。
        </div>
        <button className="btn btn-primary" onClick={() => router.push("/new")}>
          作成画面へ戻る
        </button>
      </main>
    );
  }

  return (
    <main className="container">
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>空き時間を教えてください</h1>
      <p className="muted">STEP 2 / 2 — {draft?.title}</p>

      {restored && !candidates && (
        <>
          <div className="card mt-2">
            <p className="muted" style={{ marginBottom: 8 }}>
              いつもLINEで送る、そのままの書き方で大丈夫です。
              <br />
              例)「7/27(月) 14:00〜18:00 / 7/30(木) 16:30〜18:00」
            </p>
            <AvailabilityInput
              text={text}
              onTextChange={setText}
              images={images}
              onImagesChange={setImages}
              placeholder="例) 来週の月曜午後と、木曜の16時半以降なら空いてます"
            />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" /> Alfyくんが候補を考えています…
              </>
            ) : (
              "候補をつくる"
            )}
          </button>
          <div style={{ marginTop: 10 }}>
            {/* STEP間の「もどる」は router.push で入力状態を保つ(要件C-5) */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => router.push("/new")}
            >
              ← イベント情報にもどる
            </button>
          </div>
        </>
      )}

      {restored && candidates && (
        <>
          <div className="card mt-2">
            <h2 style={{ fontSize: 17, marginBottom: 4 }}>候補をおつくりしました</h2>
            {summaryText && (
              <p style={{ fontSize: 14, marginBottom: 6 }}>{summaryText}</p>
            )}
            <p className="muted" style={{ marginBottom: 8 }}>
              不要な候補は×で削除、必要なら追加もできます。
            </p>
            {candidates.length === 0 && (
              <div className="info-box">候補がありません。追加してください。</div>
            )}
            {candidates.map((c, i) => (
              <div className="answer-row" key={`${c.date}-${c.start}-${i}`}>
                <span className="answer-label">{candidateLabel(c)}</span>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={() => removeCandidate(i)}
                  aria-label={`${candidateLabel(c)} を削除`}
                >
                  ×
                </button>
              </div>
            ))}

            <details className="mt-2">
              <summary style={{ cursor: "pointer", fontSize: 14 }}>+ 候補を手動で追加</summary>
              <div style={{ marginTop: 8 }}>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  aria-label="追加する日付"
                />
                {draft?.durationMinutes != null && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <input
                      type="time"
                      value={addStart}
                      onChange={(e) => setAddStart(e.target.value)}
                      aria-label="開始時刻"
                    />
                    <span>〜</span>
                    <input
                      type="time"
                      value={addEnd}
                      onChange={(e) => setAddEnd(e.target.value)}
                      aria-label="終了時刻"
                    />
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-outline btn-small" onClick={addCandidate}>
                    追加する
                  </button>
                </div>
              </div>
            </details>
          </div>

          {error && <div className="error-box">{error}</div>}

          <div className="stack">
            <button
              className="btn btn-gold"
              onClick={save}
              disabled={saving || candidates.length === 0}
            >
              {saving ? (
                <>
                  <span className="spinner" /> 保存しています…
                </>
              ) : (
                "この予定で確定(イベント保存)"
              )}
            </button>
            <button className="btn btn-outline" onClick={() => setCandidates(null)}>
              入力し直す
            </button>
          </div>
        </>
      )}

      <p style={{ textAlign: "center", marginTop: 14 }}>
        <button
          type="button"
          onClick={restart}
          style={{
            background: "none",
            border: "none",
            color: "var(--muted)",
            fontSize: 12,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          最初からやり直す(入力を消去)
        </button>
      </p>
    </main>
  );
}
