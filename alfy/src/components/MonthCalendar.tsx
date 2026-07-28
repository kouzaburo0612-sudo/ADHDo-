"use client";

import { useState } from "react";
import { todayJst, WEEKDAYS_JA } from "@/lib/jst";

// 候補日のカレンダー複数選択(タップでON/OFF)
// 過去日は選択不可。選択中は紺のアクティブ表示。
export default function MonthCalendar(props: {
  selected: string[];
  onChange: (dates: string[]) => void;
}) {
  const today = todayJst(); // "YYYY-MM-DD"
  const [ty, tm] = today.split("-").map(Number);
  const [viewYear, setViewYear] = useState(ty);
  const [viewMonth, setViewMonth] = useState(tm); // 1-12

  const selectedSet = new Set(props.selected);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };
  // 今月より前へは戻れない
  const canGoPrev = viewYear > ty || (viewYear === ty && viewMonth > tm);

  const toggle = (date: string) => {
    if (selectedSet.has(date)) {
      props.onChange(props.selected.filter((d) => d !== date));
    } else {
      props.onChange([...props.selected, date].sort());
    }
  };

  // 月のグリッド(日曜はじまり)を組み立てる
  const firstDay = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const leadingBlanks = firstDay.getUTCDay();
  const cells: (string | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }

  return (
    <div className="cal">
      <div className="cal-nav">
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={prevMonth}
          disabled={!canGoPrev}
          aria-label="前の月"
        >
          ‹
        </button>
        <span className="cal-title serif">
          {viewYear}年{viewMonth}月
        </span>
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={nextMonth}
          aria-label="次の月"
        >
          ›
        </button>
      </div>
      <div className="cal-grid cal-head-row">
        {WEEKDAYS_JA.map((w) => (
          <div key={w} className="cal-head">
            {w}
          </div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((date, i) =>
          date === null ? (
            <div key={`blank-${i}`} />
          ) : (
            <button
              key={date}
              type="button"
              className={`cal-day ${selectedSet.has(date) ? "selected" : ""}`}
              disabled={date < today}
              onClick={() => toggle(date)}
              aria-pressed={selectedSet.has(date)}
              aria-label={date}
            >
              {Number(date.slice(8))}
            </button>
          )
        )}
      </div>
    </div>
  );
}
