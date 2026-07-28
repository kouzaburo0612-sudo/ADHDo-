import { toDateKey } from './dates';
import type { DailyLog } from '../db/types';

/** その日の儀式が完了しているか: BODY3つ+上映+指針(仕様6.4) */
export function isDayComplete(log: DailyLog): boolean {
  return (
    log.theater === 1 &&
    log.principle === 1 &&
    log.body_meditation === 1 &&
    log.body_diet === 1 &&
    log.body_training === 1
  );
}

/**
 * ストリーク = 5項目完了した日の連続数。
 * 今日が未完了でも昨日まで続いていれば維持して表示する。
 */
export function computeStreak(logs: DailyLog[], today: Date = new Date()): number {
  const completed = new Set(logs.filter(isDayComplete).map((l) => l.date));
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!completed.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (completed.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
