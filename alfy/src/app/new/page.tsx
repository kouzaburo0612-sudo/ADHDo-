"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDraft, clearDraft } from "@/lib/draft";
import { useDraft, DRAFT_KEYS } from "@/lib/useDraft";
import { clearImages } from "@/lib/imageStore";
import MonthCalendar from "@/components/MonthCalendar";
import { formatDateJa } from "@/lib/jst";

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
  candidateDates: string[];
  timeFrom: string;
  timeTo: string;
  ngWeekdays: number[];
  memo: string;
};

const INITIAL_FORM: Step1Form = {
  title: "",
  duration: 60,
  customDuration: "",
  maxCandidates: "auto",
  deadline: "",
  candidateDates: [],
  timeFrom: "",
  timeTo: "",
  ngWeekdays: [],
  memo: "",
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
    saveDraft({
      title: form.title.trim(),
      durationMinutes,
      maxCandidates: form.maxCandidates === "auto" ? null : form.maxCandidates,
      deadline: form.deadline || null,
      candidateDates: form.candidateDates,
      timeFrom: form.timeFrom || null,
      timeTo: form.timeTo || null,
      ngWeekdays: form.ngWeekdays,
      memo: form.memo.trim(),
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
          候補日<span className="opt">任意 — カレンダーをタップして選択</span>
        </label>
        <p className="muted" style={{ marginBottom: 6 }}>
          選んだ日の中からだけ候補をつくります(選ばなければ空き時間の文章から自動判断)。
          時刻は所要時間とAlfyくんが自動で決めるので入力不要です。
        </p>
        <MonthCalendar
          selected={form.candidateDates}
          onChange={(dates) => patch({ candidateDates: dates })}
        />
        {form.candidateDates.length > 0 && (
          <p className="muted" style={{ marginTop: 6 }}>
            選択中: {form.candidateDates.map((d) => formatDateJa(d)).join(" / ")}
          </p>
        )}

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

        <label className="field-label" htmlFor="memo">
          メモ<span className="opt">任意 — 回答ページで参加者に表示されます</span>
        </label>
        <textarea
          id="memo"
          value={form.memo}
          onChange={(e) => patch({ memo: e.target.value })}
          placeholder="例) 7月の飲み会の日程調整です!お店は決まり次第連絡します🍻"
          style={{ minHeight: 80 }}
        />
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
