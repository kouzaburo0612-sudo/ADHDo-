import { describe, expect, it } from 'vitest';
import type { RitualSession } from '../../db/types';
import { computeStats } from '../stats';

let seq = 0;
function session(date: string, status: RitualSession['status'], mode = 'standard', resumed = 0): RitualSession {
  seq += 1;
  return {
    id: seq,
    date,
    mode: mode as RitualSession['mode'],
    playlist: '[]',
    current_index: 0,
    started_at: `${date}T07:00:00.000Z`,
    completed_at: status === 'COMPLETED' ? `${date}T07:03:00.000Z` : null,
    elapsed_seconds: 180,
    status,
    resumed,
  };
}

describe('computeStats', () => {
  const today = new Date(2026, 6, 28); // 2026-07-28

  it('同日の複数完了セッションは実施日数1日として数える(二重計上しない)', () => {
    const s = computeStats(
      [session('2026-07-28', 'COMPLETED'), session('2026-07-28', 'COMPLETED', 'quick')],
      today
    );
    expect(s.totalDays).toBe(1);
    expect(s.monthDone).toBe(1);
    expect(s.todayDone).toBe(true);
  });

  it('ストリーク: 今日未実施でも昨日まで続いていれば維持', () => {
    const s = computeStats(
      [session('2026-07-25', 'COMPLETED'), session('2026-07-26', 'COMPLETED'), session('2026-07-27', 'COMPLETED')],
      today
    );
    expect(s.streak).toBe(3);
    expect(s.todayDone).toBe(false);
  });

  it('ストリークが切れても累計・最長は残る', () => {
    const s = computeStats(
      [
        session('2026-07-01', 'COMPLETED'),
        session('2026-07-02', 'COMPLETED'),
        session('2026-07-03', 'COMPLETED'),
        session('2026-07-20', 'COMPLETED'),
      ],
      today
    );
    expect(s.streak).toBe(0);
    expect(s.longestStreak).toBe(3);
    expect(s.totalDays).toBe(4);
    expect(s.monthDone).toBe(4);
  });

  it('直近30日実施率・モード内訳・離脱/再開カウント', () => {
    const s = computeStats(
      [
        session('2026-07-27', 'COMPLETED', 'quick'),
        session('2026-07-26', 'COMPLETED', 'standard', 2),
        session('2026-07-25', 'ABANDONED'),
        session('2026-06-30', 'COMPLETED', 'full'),
      ],
      today
    );
    expect(s.rate30).toBe(Math.round((3 / 30) * 100));
    expect(s.modeBreakdown.quick).toBe(1);
    expect(s.modeBreakdown.standard).toBe(1);
    expect(s.modeBreakdown.full).toBe(1);
    expect(s.abandonedCount).toBe(1);
    expect(s.resumedCompletedCount).toBe(1);
  });

  it('空データでもクラッシュしない', () => {
    const s = computeStats([], today);
    expect(s.streak).toBe(0);
    expect(s.totalDays).toBe(0);
  });
});
