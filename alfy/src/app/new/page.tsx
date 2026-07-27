"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDraft, clearDraft } from "@/lib/draft";
import { useDraft, DRAFT_KEYS } from "@/lib/useDraft";
import { clearImages } from "@/lib/imageStore";

// 作成 STEP1 — 仕様書 §3-2 / 追加要件A(NG曜日)・C(入力保持)
const DURATION_OPTIONS: { label: string; value: number | "allday" | "custom" }[] = [
  { label: "30分", value: 30 },
  { label: "60分", value: 60 },
  { label: "90分", value: 90 },
  { label: "120分", value: 120 },
  { label: "終日", value: "allday" },
  { label: "カスタム", value: "custom" },
];

const COUNT_OPTIONS: (number | "auto")[] = ["auto", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// 表示は月〜日、値は 0=日〜6=土(要件A-2)
const WEEKDAY_CHIPS: { label: string; value: number }[] = [
  { label: "月", value: 1 },
  { label: "火", value: 2 },
  { label: "水", value: 3 },
  { label: "木", value: 4 },
  { label: "金", value: 5 },
  { label: "土", value: 6 },
  { label: "日", value: 0 },
];

type Step1Form = {
  title: string;
  duration: number | "allday" | "custom";
  customDuration: string;
  maxCandidates: number | "auto";
  deadline: string;
  periodFrom: string;
  periodTo: string;
  timeFrom: string;
  timeTo: string;
  ngWeekdays: number[];
};

const INITIAL_FORM: Step1Form = {
  title: "",
  duration: 60,
  customDuration: "",
  maxCandidates: "auto",
  deadline: "",
  periodFrom: "",
  periodTo: "",
  timeFrom: "",
  timeTo: "",
  ngWeekdays: [],
};

export default function NewEventPage() {
  const router = useRouter();
  // 入力のたびに自動保存し、戻る・進む・リロードでも消えない(要件C)
  const { value: form, setValue: setForm, clear: clearForm } = useDraft<Step1Form>(
    DRAFT_KEYS.step1,
    INITIAL_FORM
  );
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<Step1Form>) => setForm((prev) => ({ ...prev, ...p }));

  const toggleWeekday = (value: number) => {
    setForm((prev) => ({
      ...prev,
      ngWeekdays: prev.ngWeekdays.includes(value)
        ? prev.ngWeekdays.filter((d) => d !== value)
        : [...prev.ngWeekdays, value],
    }));
  };

  // 明示破棄(要件C-4)
  const restart = () => {
    if (!window.confirm("入力内容をすべて消して最初からやり直しますか?")) return;
    clearForm();
    clearDraft();
    sessionStorage.removeItem(DRAFT_KEYS.step2);
    clearImages(DRAFT_KEYS.step2Images);
    setForm(INITIAL_FORM);
    setError(null);
  };

  const next = () => {
    setError(null);
    if (!form.title.trim()) {
      setError("イベント名を入力してください");
      return;
    }
    let durationMinutes: number | null;
    if (form.duration === "allday") {
      durationMinutes = null;
    } else if (form.duration === "custom") {
      const n = parseInt(form.customDuration, 10);
      if (!n || n <= 0) {
        setError("カスタムの分数を入力してください");
        return;
      }
      durationMinutes = n;
    } else {
      durationMinutes = form.duration;
    }
    if (form.periodFrom && form.periodTo && form.periodFrom > form.periodTo) {
      setError("候補期間の開始と終了が逆になっています");
      return;
    }
    saveDraft({
      title: form.title.trim(),
      durationMinutes,
      maxCandidates: form.maxCandidates === "auto" ? null : form.maxCandidates,
      deadline: form.deadline || null,
      periodFrom: form.periodFrom || null,
      periodTo: form.periodTo || null,
      timeFrom: form.timeFrom || null,
      timeTo: form.timeTo || null,
      ngWeekdays: form.ngWeekdays,
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
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
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
              className={`chip ${form.duration === opt.value ? "selected" : ""}`}
              onClick={() => patch({ duration: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {form.duration === "custom" && (
          <input
            type="number"
            inputMode="numeric"
            min={5}
            step={5}
            value={form.customDuration}
            onChange={(e) => patch({ customDuration: e.target.value })}
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
              className={`chip ${form.maxCandidates === opt ? "selected" : ""}`}
              onClick={() => patch({ maxCandidates: opt })}
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
          value={form.deadline}
          onChange={(e) => patch({ deadline: e.target.value })}
        />

        <label className="field-label">
          候補期間<span className="opt">任意</span>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={form.periodFrom}
            onChange={(e) => patch({ periodFrom: e.target.value })}
            aria-label="候補期間の開始日"
          />
          <span>〜</span>
          <input
            type="date"
            value={form.periodTo}
            onChange={(e) => patch({ periodTo: e.target.value })}
            aria-label="候補期間の終了日"
          />
        </div>

        <label className="field-label">
          時間帯<span className="opt">任意 (例: 11:00〜18:00)</span>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="time"
            value={form.timeFrom}
            onChange={(e) => patch({ timeFrom: e.target.value })}
            aria-label="時間帯の開始"
          />
          <span>〜</span>
          <input
            type="time"
            value={form.timeTo}
            onChange={(e) => patch({ timeTo: e.target.value })}
            aria-label="時間帯の終了"
          />
        </div>

        <label className="field-label">
          NG曜日<span className="opt">任意</span>
        </label>
        <div className="chip-row">
          {WEEKDAY_CHIPS.map((d) => (
            <button
              key={d.value}
              type="button"
              className={`chip ${form.ngWeekdays.includes(d.value) ? "selected" : ""}`}
              onClick={() => toggleWeekday(d.value)}
              aria-pressed={form.ngWeekdays.includes(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          選んだ曜日は候補から外します
        </p>
      </div>

      {error && <div className="error-box">{error}</div>}

      <button className="btn btn-primary" onClick={next}>
        次へ(空き時間の入力)
      </button>

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
