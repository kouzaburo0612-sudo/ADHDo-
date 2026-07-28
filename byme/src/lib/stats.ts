/**
 * 実施統計(純関数)。ritual_sessions を入力に、習慣化の状態を計算する。
 * ストリークが切れても積み上げ(累計・実施率)をゼロ扱いしない。
 * 同日に複数の完了セッションがあっても実施日数は1日として数える(二重計上しない)。
 */
import type { RitualSession } from '../db/types';
import { toDateKey } from './dates';

export interface HabitStats {
  /** 今日完了しているか */
  todayDone: boolean;
  /** 現在の連続実施日数(今日未実施でも昨日まで続いていれば維持) */
  streak: number;
  longestStreak: number;
  /** 今月の実施日数 */
  monthDone: number;
  monthDays: number;
  /** 直近30日の実施率(0〜100) */
  rate30: number;
  /** 累計実施日数 */
  totalDays: number;
  /** モード別の完了回数 */
  modeBreakdown: Record<string, number>;
  /** 途中離脱回数 */
  abandonedCount: number;
  /** 再開して完了した回数 */
  resumedCompletedCount: number;
}

export function completedDates(sessions: RitualSession[]): Set<string> {
  return new Set(sessions.filter((s) => s.status === 'COMPLETED').map((s) => s.date));
}

export function computeStats(sessions: RitualSession[], today: Date = new Date()): HabitStats {
  const done = completedDates(sessions);
  const todayKey = toDateKey(today);

  // 現在ストリーク
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!done.has(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (done.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 最長ストリーク
  let longest = 0;
  const sorted = [...done].sort();
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const [y, m, d] = key.split('-').map(Number);
    const cur = new Date(y, m - 1, d);
    if (prev && cur.getTime() - prev.getTime() === 86400000) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = cur;
  }

  // 今月
  const monthPrefix = todayKey.slice(0, 7);
  const monthDone = [...done].filter((d) => d.startsWith(monthPrefix)).length;

  // 直近30日
  let done30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    if (done.has(toDateKey(d))) done30 += 1;
  }

  const modeBreakdown: Record<string, number> = {};
  let abandonedCount = 0;
  let resumedCompletedCount = 0;
  for (const s of sessions) {
    if (s.status === 'COMPLETED') {
      modeBreakdown[s.mode] = (modeBreakdown[s.mode] ?? 0) + 1;
      if (s.resumed > 0) resumedCompletedCount += 1;
    }
    if (s.status === 'ABANDONED') abandonedCount += 1;
  }

  return {
    todayDone: done.has(todayKey),
    streak,
    longestStreak: longest,
    monthDone,
    monthDays: today.getDate(),
    rate30: Math.round((done30 / 30) * 100),
    totalDays: done.size,
    modeBreakdown,
    abandonedCount,
    resumedCompletedCount,
  };
}
