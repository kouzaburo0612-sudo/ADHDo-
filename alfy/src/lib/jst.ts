// JST(Asia/Tokyo)基準の日付ユーティリティ。日付のハードコード禁止(仕様書 §5)。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function nowJst(): Date {
  return new Date(Date.now() + JST_OFFSET_MS);
}

// "YYYY-MM-DD" (JST今日)
export function todayJst(): string {
  return nowJst().toISOString().slice(0, 10);
}

export const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

// "2026-07-27" -> 曜日番号(0=日〜6=土)
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// "2026-07-27" -> "7/27(月)"
export function formatDateJa(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEKDAYS_JA[day]})`;
}

// "14:30:00" | "14:30" -> "14:30"
export function formatTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

// スロットの表示ラベル: "7/27(月) 14:30〜15:30" / 終日 "7/27(月) 終日"
export function slotLabel(slot: {
  date: string;
  start_time: string | null;
  end_time: string | null;
}): string {
  const d = formatDateJa(slot.date);
  if (!slot.start_time) return `${d} 終日`;
  return `${d} ${formatTime(slot.start_time)}〜${formatTime(slot.end_time)}`;
}

// JSTの曜日付きフル表記 "2026年7月27日(月)"
export function formatDateJaLong(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${y}年${m}月${d}日(${WEEKDAYS_JA[day]})`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
