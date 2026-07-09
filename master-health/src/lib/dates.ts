/** 日付ユーティリティ(すべて端末ローカルタイム基準、キーは 'YYYY-MM-DD') */

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function todayKey(): string {
  return toKey(new Date());
}

export function daysAgoKey(n: number): string {
  return toKey(addDays(new Date(), -n));
}

/** その週の月曜日 */
export function mondayOf(d: Date): Date {
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7; // 月=0
  r.setDate(r.getDate() - dow);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function formatKeyJa(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
