/** 日付ユーティリティ。すべてデバイスのローカルタイムゾーン基準。 */

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** 1月1日を1とする通日 */
export function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1;
}

/** deadline (YYYY-MM-DD) までの残日数。過ぎていれば負数。 */
export function daysUntil(deadline: string, from: Date = new Date()): number {
  const [y, m, d] = deadline.split('-').map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

export function formatDateJp(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export function formatMonthJp(year: number, month0: number): string {
  return `${year}年${month0 + 1}月`;
}

/** "HH:MM" をパース。無効なら null。 */
export function parseHHMM(v: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
