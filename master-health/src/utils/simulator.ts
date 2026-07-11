/**
 * 目標逆算シミュレーター
 * ======================
 * 直近の実績ペース(対象指標の7日移動平均の傾き)から、
 * 楽観 / 中央値 / 悲観 の3シナリオで目標到達日を予測する。
 *
 * シナリオの作り方:
 * - 中央値: 直近28日の移動平均トレンドの傾きをそのまま外挿
 * - 楽観:   傾き × 1.3 (ペースが3割改善した場合)
 * - 悲観:   傾き × 0.7 (ペースが3割鈍化した場合)
 *   ±30%は「日々の生活のブレでこの程度は揺れる」という経験的レンジ。
 * 改善方向に進んでいない(傾きが目標と逆向き)場合はnull(=予測不能)を返す。
 */
import { linearRegression, mean } from '@/utils/stats';

export interface ScenarioResult {
  optimistic: string | null;  // ISO date
  median: string | null;
  pessimistic: string | null;
  /** 1日あたりの実績変化量(表示用) */
  dailyChange: number | null;
}

/**
 * @param series 日付昇順の {date, value}(対象指標の実測値、欠測日は含めない)
 * @param target 目標値
 */
export function simulateGoal(series: { date: string; value: number }[], target: number): ScenarioResult {
  if (series.length < 7) return { optimistic: null, median: null, pessimistic: null, dailyChange: null };

  // 7日移動平均でノイズ除去
  const ma: { x: number; y: number; date: string }[] = [];
  for (let i = 0; i < series.length; i++) {
    const win = series.slice(Math.max(0, i - 6), i + 1).map((p) => p.value);
    const m = mean(win);
    if (m != null) ma.push({ x: i, y: m, date: series[i].date });
  }
  const recent = ma.slice(-28);
  const reg = linearRegression(recent.map((p) => ({ x: p.x, y: p.y })));
  if (!reg) return { optimistic: null, median: null, pessimistic: null, dailyChange: null };

  const current = recent[recent.length - 1].y;
  const gap = target - current;                 // 進むべき残り(符号つき)
  const slope = reg.slope;                       // 実績の1日あたり変化(符号つき)

  // 傾きが目標方向と逆、またはほぼ0なら予測不能
  if (slope === 0 || Math.sign(gap) !== Math.sign(slope)) {
    return { optimistic: null, median: null, pessimistic: null, dailyChange: slope };
  }

  const lastDate = new Date(recent[recent.length - 1].date);
  const project = (mult: number): string | null => {
    const days = Math.ceil(gap / (slope * mult));
    if (!isFinite(days) || days < 0 || days > 365 * 3) return null; // 3年超は表示しない
    const d = new Date(lastDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  return {
    optimistic: project(1.3),
    median: project(1.0),
    pessimistic: project(0.7),
    dailyChange: slope,
  };
}
