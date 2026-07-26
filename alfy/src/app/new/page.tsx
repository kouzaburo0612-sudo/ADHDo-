"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDraft } from "@/lib/draft";

// 作成 STEP1 — 仕様書 §3-2
const DURATION_OPTIONS: { label: string; value: number | "allday" | "custom" }[] = [
  { label: "30分", value: 30 },
  { label: "60分", value: 60 },
  { label: "90分", value: 90 },
  { label: "120分", value: 120 },
  { label: "終日", value: "allday" },
  { label: "カスタム", value: "custom" },
];

const COUNT_OPTIONS: (number | "auto")[] = ["auto", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number | "allday" | "custom">(60);
  const [customDuration, setCustomDuration] = useState("");
  const [maxCandidates, setMaxCandidates] = useState<number | "auto">("auto");
  const [deadline, setDeadline] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    setError(null);
    if (!title.trim()) {
      setError("イベント名を入力してください");
      return;
    }
    let durationMinutes: number | null;
    if (duration === "allday") {
      durationMinutes = null;
    } else if (duration === "custom") {
      const n = parseInt(customDuration, 10);
      if (!n || n <= 0) {
        setError("カスタムの分数を入力してください");
        return;
      }
      durationMinutes = n;
    } else {
      durationMinutes = duration;
    }
    if (periodFrom && periodTo && periodFrom > periodTo) {
      setError("候補期間の開始と終了が逆になっています");
      return;
    }
    saveDraft({
      title: title.trim(),
      durationMinutes,
      maxCandidates: maxCandidates === "auto" ? null : maxCandidates,
      deadline: deadline || null,
      periodFrom: periodFrom || null,
      periodTo: periodTo || null,
      timeFrom: timeFrom || null,
      timeTo: timeTo || null,
    });
    router.push("/new/google");
  };

  return (
    <main className="container">
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>日程調整をつくる</h1>
      <p className="muted">STEP 1 / 2 — イベントの基本情報</p>

      <div className="card mt-2">
        <label className="field-label" htmlFor="title">
          イベント名<span className="req">必須</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例) 7月の定例ミーティング"
        />

        <label className="field-label">
          所要時間<span className="req">必須</span>
        </label>
        <div className="chip-row">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              className={`chip ${duration === opt.value ? "selected" : ""}`}
              onClick={() => setDuration(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {duration === "custom" && (
          <input
            type="number"
            inputMode="numeric"
            min={5}
            step={5}
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
            placeholder="分数を入力(例: 45)"
          />
        )}

        <label className="field-label">
          候補数<span className="req">必須</span>
        </label>
        <div className="chip-row">
          {COUNT_OPTIONS.map((opt) => (
            <button
              key={String(opt)}
              type="button"
              className={`chip ${maxCandidates === opt ? "selected" : ""}`}
              onClick={() => setMaxCandidates(opt)}
            >
              {opt === "auto" ? "できるだけ" : `${opt}件`}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="deadline">
          回答締切<span className="opt">任意</span>
        </label>
        <input
          id="deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />

        <label className="field-label">
          候補期間<span className="opt">任意</span>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
            aria-label="候補期間の開始日"
          />
          <span>〜</span>
          <input
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            aria-label="候補期間の終了日"
          />
        </div>

        <label className="field-label">
          時間帯<span className="opt">任意 (例: 11:00〜18:00)</span>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="time"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
            aria-label="時間帯の開始"
          />
          <span>〜</span>
          <input
            type="time"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
            aria-label="時間帯の終了"
          />
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <button className="btn btn-primary" onClick={next}>
        次へ(空き時間の入力)
      </button>
    </main>
  );
}
