import { toDateKey } from './dates';
import type { RitualDay } from '../db/types';

function isComplete(r: RitualDay): boolean {
  return r.declared === 1 && r.principle === 1 && r.journal === 1;
}

/**
 * ストリーク = 3項目完了した日の連続数。
 * 今日が未完了でも昨日まで続いていればストリークは維持して表示する。
 */
export function computeStreak(days: RitualDay[], today: Date = new Date()): number {
  const completed = new Set(days.filter(isComplete).map((r) => r.date));
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // 今日未完了の場合は昨日から数え始める
  if (!completed.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (completed.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** その日の完了数 0..3(ヒートマップ用) */
export function ritualScore(r: RitualDay | undefined): number {
  if (!r) return 0;
  return (r.declared ? 1 : 0) + (r.principle ? 1 : 0) + (r.journal ? 1 : 0);
}
