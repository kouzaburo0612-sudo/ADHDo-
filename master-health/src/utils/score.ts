/**
 * 総合健康スコアの算出ロジック
 * =============================
 *
 * 設計方針(調整するときはここを読む):
 *
 * 1. カテゴリ別スコア(睡眠・回復・体組成・活動量)を各0-100で算出し、
 *    設定画面の重みで加重平均して総合スコアを出す。
 *    データが無いカテゴリは除外し、残りの重みを再正規化する。
 *
 * 2. 各指標の評価は2本立て:
 *    - 相対評価: 本人の「過去60日ベースライン」からのzスコア。
 *      score = 50 + z * 20 (±2.5σで0/100に張り付く)。
 *      「いつもの自分と比べてどうか」を表す。ウェアラブル指標(HRV・心拍等)は
 *      個人差が大きく絶対値の基準が立てにくいため、これを主軸にする。
 *    - 絶対評価: 一般的な健康基準(睡眠7時間以上、歩数目標等)との比較。
 *      目標に対する達成率ベース。
 *    カテゴリごとに両者をブレンドする(比率は各関数のコメント参照)。
 *
 * 3. zスコア→点数の変換に20/σを使う理由:
 *    ±1σ(普段の変動範囲)が30〜70点に収まり、日々の揺らぎで極端な点数が
 *    出ない。2.5σ超え(明確な異常)だけが0/100に達する。
 */
import { clamp, zScore } from '@/utils/stats';
import type { MetricKey } from '@/lib/metrics';
import type { ScoreWeights, Settings } from '@/lib/settings';

export interface ScoreInput {
  /** 当日の値 */
  today: Partial<Record<MetricKey, number>>;
  /** 過去60日(当日を含まない)の指標ごとの履歴 */
  history: Partial<Record<MetricKey, number[]>>;
  settings: Settings;
}

export interface Scores {
  total: number | null;
  sleep: number | null;
  recovery: number | null;
  body: number | null;
  activity: number | null;
}

/** 相対評価: ベースラインからのzスコアを0-100に写像 */
function relative(value: number | undefined, history: number[] | undefined, higherIsBetter: boolean): number | null {
  if (value == null || !history || history.length < 7) return null; // 1週間分未満は評価しない
  const z = zScore(value, history);
  if (z == null) return null;
  const signed = higherIsBetter ? z : -z;
  return clamp(50 + signed * 20, 0, 100);
}

/** 絶対評価: 目標達成率(cap以上で満点) */
function ratioScore(value: number, goal: number, cap = 1.0): number {
  if (goal <= 0) return 100;
  return clamp((value / goal / cap) * 100, 0, 100);
}

/**
 * 睡眠スコア
 * - 睡眠時間(重み0.5): 絶対評価70% + 相対評価30%。
 *   目標時間(初期値7.5h)に対して、不足は線形減点。超過は減点しない
 *   (寝すぎのペナルティは初版では入れない。必要になったら追加)。
 * - 深い睡眠(0.25)・レム睡眠(0.25): 相対評価のみ。
 *   ステージ配分の理想値は個人差が大きすぎるため、絶対基準は使わない。
 */
export function sleepScore(input: ScoreInput): number | null {
  const { today, history, settings } = input;
  const total = today.sleep_total;
  if (total == null) return null;

  const abs = ratioScore(total, settings.sleepGoalMin);
  const rel = relative(total, history.sleep_total, true);
  const durationScore = rel == null ? abs : abs * 0.7 + rel * 0.3;

  const deep = relative(today.sleep_deep, history.sleep_deep, true);
  const rem = relative(today.sleep_rem, history.sleep_rem, true);

  let score = durationScore * 0.5;
  let weight = 0.5;
  if (deep != null) { score += deep * 0.25; weight += 0.25; }
  if (rem != null) { score += rem * 0.25; weight += 0.25; }
  return clamp(score / weight, 0, 100);
}

/**
 * 回復スコア(HRV・安静時心拍・体表温)
 * - HRV(重み0.5): 相対評価。高いほど良い。
 * - 安静時心拍(0.35): 相対評価。低いほど良い。
 * - 体表温(0.15): 平常から離れるほど減点(|z|1つで-20点)。
 *   方向を問わないのは、上振れ(発熱・炎症)も下振れ(環境要因等)も
 *   「普段と違う」シグナルとして扱うため。
 */
export function recoveryScore(input: ScoreInput): number | null {
  const { today, history } = input;
  const hrv = relative(today.hrv, history.hrv, true);
  const rhr = relative(today.rhr, history.rhr, false);

  let temp: number | null = null;
  if (today.wrist_temp != null && history.wrist_temp && history.wrist_temp.length >= 7) {
    const z = zScore(today.wrist_temp, history.wrist_temp);
    if (z != null) temp = clamp(100 - Math.abs(z) * 20, 0, 100);
  }

  const parts: { v: number; w: number }[] = [];
  if (hrv != null) parts.push({ v: hrv, w: 0.5 });
  if (rhr != null) parts.push({ v: rhr, w: 0.35 });
  if (temp != null) parts.push({ v: temp, w: 0.15 });
  if (parts.length === 0) return null;
  const wSum = parts.reduce((a, p) => a + p.w, 0);
  return clamp(parts.reduce((a, p) => a + p.v * p.w, 0) / wSum, 0, 100);
}

/**
 * 体組成スコア(体脂肪率の目標達成 + トレンド)
 * - 位置(重み0.7): 目標体脂肪率との差。目標以下で100点、
 *   1%上回るごとに-8点(例: 目標14.9%で18.9%なら68点)。
 *   「-8点/%」は、±4%の範囲でスコアが意味を持つように選んだ係数。
 * - トレンド(0.3): 直近30日ベースラインとの相対評価(低いほど良い)。
 *   日々の測定ノイズを吸収しつつ、改善方向なら加点される。
 * - 体脂肪率が無い日は体重で代用(目標体重設定時のみ)。
 */
export function bodyScore(input: ScoreInput): number | null {
  const { today, history, settings } = input;
  const bf = today.body_fat ?? lastOf(history.body_fat);
  if (bf != null) {
    const position = clamp(100 - Math.max(0, bf - settings.bodyFatGoal) * 8, 0, 100);
    const rel = relative(bf, history.body_fat, false);
    return rel == null ? position : clamp(position * 0.7 + rel * 0.3, 0, 100);
  }
  if (settings.weightGoal != null) {
    const w = today.weight ?? lastOf(history.weight);
    if (w == null) return null;
    return clamp(100 - Math.max(0, w - settings.weightGoal) * 5, 0, 100);
  }
  return null;
}

/**
 * 活動量スコア(歩数 + アクティブカロリー)
 * - 歩数(重み0.6): 絶対評価。目標歩数に対する達成率。
 * - アクティブカロリー(0.4): 相対評価。「いつもより動いたか」。
 *   カロリーの絶対目標は個人差・機器差が大きいため使わない。
 */
export function activityScore(input: ScoreInput): number | null {
  const { today, history, settings } = input;
  const parts: { v: number; w: number }[] = [];
  if (today.steps != null) parts.push({ v: ratioScore(today.steps, settings.stepsGoal), w: 0.6 });
  const energy = relative(today.active_energy, history.active_energy, true);
  if (energy != null) parts.push({ v: energy, w: 0.4 });
  if (parts.length === 0) return null;
  const wSum = parts.reduce((a, p) => a + p.w, 0);
  return clamp(parts.reduce((a, p) => a + p.v * p.w, 0) / wSum, 0, 100);
}

/** 総合スコア: カテゴリの加重平均(欠測カテゴリは重みを再正規化) */
export function computeScores(input: ScoreInput): Scores {
  const s: Scores = {
    sleep: roundOrNull(sleepScore(input)),
    recovery: roundOrNull(recoveryScore(input)),
    body: roundOrNull(bodyScore(input)),
    activity: roundOrNull(activityScore(input)),
    total: null,
  };
  const w = input.settings.weights;
  const parts: { v: number; w: number }[] = [];
  (['sleep', 'recovery', 'body', 'activity'] as (keyof ScoreWeights)[]).forEach((k) => {
    const v = s[k];
    if (v != null && w[k] > 0) parts.push({ v, w: w[k] });
  });
  if (parts.length > 0) {
    const wSum = parts.reduce((a, p) => a + p.w, 0);
    s.total = Math.round(parts.reduce((a, p) => a + p.v * p.w, 0) / wSum);
  }
  return s;
}

function lastOf(xs: number[] | undefined): number | null {
  return xs && xs.length > 0 ? xs[xs.length - 1] : null;
}

function roundOrNull(x: number | null): number | null {
  return x == null ? null : Math.round(x);
}
