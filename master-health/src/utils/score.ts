/**
 * スコアエンジン (Oura準拠の4スコア + 根拠つき)
 * ==============================================
 *
 * 総合スコアは廃止し、Ouraと同じ考え方の4スコアを出す:
 * - コンディション (Ouraのコンディション/readiness相当):
 *   安静時心拍・HRVバランス・体温・昨晩の睡眠・前日の活動バランス
 * - 睡眠 (Ouraのsleep score相当):
 *   合計睡眠・深い睡眠・レム睡眠・いつもとの比較
 * - 活動 (Ouraのactivity score相当):
 *   歩数・アクティブカロリー・エクササイズ時間
 * - 体組成 (VYTA独自): 目標体脂肪率との位置 + 30日トレンド
 *
 * 各スコアは contributor(構成要素)ごとの部分点を持ち、UIで根拠を表示する。
 *
 * 評価方法:
 * - 相対評価: 過去60日ベースラインからのzスコア → 50 + z*20 (±2.5σで0/100)。
 *   ウェアラブル指標は個人差が大きいため「いつもの自分と比べてどうか」を主軸にする。
 * - 絶対評価: 一般基準(睡眠7.5h、深い睡眠90分、歩数目標等)に対する達成率。
 */
import { clamp, zScore, mean } from '@/utils/stats';
import type { MetricKey } from '@/lib/metrics';
import type { Settings } from '@/lib/settings';

export interface ScoreInput {
  /** 当日の値 */
  today: Partial<Record<MetricKey, number>>;
  /** 前日の値(コンディションの「前日の活動」用) */
  yesterday: Partial<Record<MetricKey, number>>;
  /** 過去60日(当日を含まない)の指標ごとの履歴 */
  history: Partial<Record<MetricKey, number[]>>;
  settings: Settings;
}

/** スコアの構成要素(根拠表示用) */
export interface ScorePart {
  label: string;
  /** 実測値と基準を人間向けに説明する短文 */
  detail: string;
  score: number | null;
  weight: number;
}

export interface CategoryScore {
  score: number | null;
  parts: ScorePart[];
}

export interface Scores {
  condition: CategoryScore;
  sleep: CategoryScore;
  activity: CategoryScore;
  body: CategoryScore;
}

export const EMPTY_CATEGORY: CategoryScore = { score: null, parts: [] };

// ---- 共通ヘルパー ----

/** 相対評価: ベースラインからのzスコアを0-100に写像 */
function relative(value: number | undefined, history: number[] | undefined, higherIsBetter: boolean): number | null {
  if (value == null || !history || history.length < 7) return null;
  const z = zScore(value, history);
  if (z == null) return null;
  const signed = higherIsBetter ? z : -z;
  return clamp(50 + signed * 20, 0, 100);
}

/** 絶対評価: 目標達成率(goal以上で満点) */
function ratioScore(value: number, goal: number): number {
  if (goal <= 0) return 100;
  return clamp((value / goal) * 100, 0, 100);
}

function avgOf(history: number[] | undefined): number | null {
  if (!history || history.length < 7) return null;
  return mean(history.slice(-60));
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** 非null部分点の加重平均 */
function combine(parts: ScorePart[]): number | null {
  const usable = parts.filter((p) => p.score != null);
  if (usable.length === 0) return null;
  const wSum = usable.reduce((a, p) => a + p.weight, 0);
  return Math.round(clamp(usable.reduce((a, p) => a + p.score! * p.weight, 0) / wSum, 0, 100));
}

/** 相対評価の説明文 */
function vsUsual(value: number, avg: number | null, unit: string, decimals = 0): string {
  const v = value.toFixed(decimals);
  if (avg == null) return `${v}${unit}(基準データ蓄積中)`;
  return `${v}${unit}(60日平均 ${avg.toFixed(decimals)}${unit})`;
}

// ---- 睡眠スコア (Oura準拠) ----

export function sleepScoreDetail(input: ScoreInput): CategoryScore {
  const { today, history, settings } = input;
  const total = today.sleep_total;
  if (total == null) return { score: null, parts: [] };

  const goal = settings.sleepGoalMin; // 初期値 7.5h
  const parts: ScorePart[] = [];

  // 合計睡眠: 目標に対する達成率(Ouraの「合計睡眠」)
  parts.push({
    label: '合計睡眠',
    detail: `${fmtDuration(total)} / 目標 ${fmtDuration(goal)}`,
    score: ratioScore(total, goal),
    weight: 0.35,
  });

  // 深い睡眠: 90分を満点基準(一般的な理想量)+ 本人比
  const deep = today.sleep_deep;
  if (deep != null) {
    const abs = ratioScore(deep, 90);
    const rel = relative(deep, history.sleep_deep, true);
    parts.push({
      label: '深い睡眠',
      detail: `${fmtDuration(deep)} / 理想 1h30m`,
      score: rel == null ? abs : abs * 0.6 + rel * 0.4,
      weight: 0.25,
    });
  }

  // レム睡眠: 90分を満点基準
  const rem = today.sleep_rem;
  if (rem != null) {
    const abs = ratioScore(rem, 90);
    const rel = relative(rem, history.sleep_rem, true);
    parts.push({
      label: 'レム睡眠',
      detail: `${fmtDuration(rem)} / 理想 1h30m`,
      score: rel == null ? abs : abs * 0.6 + rel * 0.4,
      weight: 0.25,
    });
  }

  // いつもとの比較(睡眠の安定性)
  const rel = relative(total, history.sleep_total, true);
  if (rel != null) {
    parts.push({
      label: 'いつもとの比較',
      detail: vsUsual(total / 60, (avgOf(history.sleep_total) ?? 0) / 60 || null, 'h', 1),
      score: rel,
      weight: 0.15,
    });
  }

  return { score: combine(parts), parts };
}

// ---- コンディションスコア (Ouraのreadiness準拠) ----

export function conditionScoreDetail(input: ScoreInput): CategoryScore {
  const { today, yesterday, history } = input;
  const parts: ScorePart[] = [];

  // HRVバランス: 本人ベースライン比(高いほど良い)
  if (today.hrv != null) {
    parts.push({
      label: 'HRVバランス',
      detail: vsUsual(today.hrv, avgOf(history.hrv), 'ms'),
      score: relative(today.hrv, history.hrv, true),
      weight: 0.3,
    });
  }

  // 安静時心拍: 本人ベースライン比(低いほど良い)
  if (today.rhr != null) {
    parts.push({
      label: '安静時心拍',
      detail: vsUsual(today.rhr, avgOf(history.rhr), 'bpm'),
      score: relative(today.rhr, history.rhr, false),
      weight: 0.25,
    });
  }

  // 体温: 平常から離れるほど減点(上振れも下振れも異常シグナル)
  if (today.wrist_temp != null && history.wrist_temp && history.wrist_temp.length >= 7) {
    const z = zScore(today.wrist_temp, history.wrist_temp);
    if (z != null) {
      parts.push({
        label: '体温',
        detail: `平常との差 ${z >= 0 ? '+' : ''}${(today.wrist_temp - (avgOf(history.wrist_temp) ?? today.wrist_temp)).toFixed(2)}°C`,
        score: clamp(100 - Math.abs(z) * 20, 0, 100),
        weight: 0.15,
      });
    }
  }

  // 昨晩の睡眠
  const sleep = sleepScoreDetail(input);
  if (sleep.score != null) {
    parts.push({
      label: '昨晩の睡眠',
      detail: `睡眠スコア ${sleep.score}`,
      score: sleep.score,
      weight: 0.2,
    });
  }

  // 前日の活動バランス: 動きすぎも動かなすぎも回復に響く(|z|で減点)
  if (yesterday.active_energy != null && history.active_energy && history.active_energy.length >= 7) {
    const z = zScore(yesterday.active_energy, history.active_energy);
    if (z != null) {
      parts.push({
        label: '前日の活動バランス',
        detail: z > 1 ? 'いつもより多め' : z < -1 ? 'いつもより少なめ' : 'いつも並み',
        score: clamp(100 - Math.max(0, Math.abs(z) - 0.5) * 25, 0, 100),
        weight: 0.1,
      });
    }
  }

  return { score: combine(parts), parts };
}

// ---- 活動スコア (Ouraのactivity準拠) ----

export function activityScoreDetail(input: ScoreInput): CategoryScore {
  const { today, history, settings } = input;
  const parts: ScorePart[] = [];

  if (today.steps != null) {
    parts.push({
      label: '歩数',
      detail: `${Math.round(today.steps).toLocaleString()}歩 / 目標 ${settings.stepsGoal.toLocaleString()}歩`,
      score: ratioScore(today.steps, settings.stepsGoal),
      weight: 0.4,
    });
  }

  if (today.active_energy != null) {
    const abs = ratioScore(today.active_energy, 450); // Ouraのデイリー目標中庸値
    const rel = relative(today.active_energy, history.active_energy, true);
    parts.push({
      label: 'アクティブカロリー',
      detail: `${Math.round(today.active_energy)}kcal / 目標 450kcal`,
      score: rel == null ? abs : abs * 0.6 + rel * 0.4,
      weight: 0.35,
    });
  }

  if (today.exercise_time != null) {
    parts.push({
      label: 'エクササイズ時間',
      detail: `${Math.round(today.exercise_time)}分 / 目標 30分`,
      score: ratioScore(today.exercise_time, 30),
      weight: 0.25,
    });
  }

  return { score: combine(parts), parts };
}

// ---- 体組成スコア (VYTA独自) ----

export function bodyScoreDetail(input: ScoreInput): CategoryScore {
  const { today, history, settings } = input;
  const parts: ScorePart[] = [];
  const bf = today.body_fat ?? lastOf(history.body_fat);

  if (bf != null) {
    // 位置: 目標以下で100点、1%上回るごとに-8点
    parts.push({
      label: '目標との位置',
      detail: `体脂肪率 ${bf.toFixed(1)}% / 目標 ${settings.bodyFatGoal}%`,
      score: clamp(100 - Math.max(0, bf - settings.bodyFatGoal) * 8, 0, 100),
      weight: 0.7,
    });
    const rel = relative(bf, history.body_fat, false);
    if (rel != null) {
      parts.push({
        label: '30日トレンド',
        detail: rel >= 55 ? '改善方向' : rel <= 45 ? '悪化方向' : '横ばい',
        score: rel,
        weight: 0.3,
      });
    }
  } else if (settings.weightGoal != null) {
    const w = today.weight ?? lastOf(history.weight);
    if (w != null) {
      parts.push({
        label: '目標体重との位置',
        detail: `${w.toFixed(1)}kg / 目標 ${settings.weightGoal}kg`,
        score: clamp(100 - Math.max(0, w - settings.weightGoal) * 5, 0, 100),
        weight: 1,
      });
    }
  }

  return { score: combine(parts), parts };
}

// ---- まとめ ----

export function computeScores(input: ScoreInput): Scores {
  return {
    condition: conditionScoreDetail(input),
    sleep: sleepScoreDetail(input),
    activity: activityScoreDetail(input),
    body: bodyScoreDetail(input),
  };
}

function lastOf(xs: number[] | undefined): number | null {
  return xs && xs.length > 0 ? xs[xs.length - 1] : null;
}
