/**
 * 実績TDEEエンジン (2系統)
 * =========================
 *
 * 1. 活動ベース (activity):
 *    TDEE = BMR + NEAT + 運動消費 + DIT
 *    - BMR: Mifflin-St Jeor (男性: 10W + 6.25H - 5A + 5 / 女性: -161)
 *    - NEAT: 実測歩数 × 0.04 kcal/歩 (体重60-80kg帯の歩行消費の一般的近似)
 *    - 運動: HealthKitのactive_energyがあれば優先。無い日はトレ記録1回=250kcalの粗い近似
 *      (active_energyにはNEATも含まれるため、ある日はNEATを歩数分と二重計上しない
 *       → active_energyがある日は BMR + active_energy + DIT とする)
 *    - DIT: 食事誘発性熱産生 = 摂取kcal × 0.10
 *
 * 2. 逆算ベース (reverse):
 *    TDEE = 平均摂取kcal - (体重変化ペース kg/日 × 7200 kcal/kg)
 *    - 体重は7日移動平均の傾き(最小二乗)を使い、単日ノイズを除去
 *    - 摂取記録が14日以上蓄積されるまでは信頼できないため無効
 *
 * どちらも直近14日窓。2つの乖離はロギング精度のシグナルとして表示する。
 */
import { linearRegression } from '@/utils/stats';

export interface TdeeInput {
  /** 日付キー昇順の直近データ(最大14日) */
  days: {
    date: string;
    intakeKcal: number | null;   // 食事記録の日合計(記録なしはnull)
    steps: number | null;
    activeEnergy: number | null; // HealthKit実測
    workoutCount: number;
    weightMA7: number | null;    // 体重7日移動平均
  }[];
  profile: { heightCm: number | null; birthDate: string | null; sex: 'male' | 'female' };
  latestWeightKg: number | null;
}

export interface TdeeResult {
  activity: number | null;
  reverse: number | null;
  /** 表示・計算に使う代表値(逆算があれば逆算、なければ活動ベース) */
  effective: number | null;
  bmr: number | null;
  loggedDays: number;
}

export function mifflinStJeor(weightKg: number, heightCm: number, ageYears: number, sex: 'male' | 'female'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  return Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function computeTdee(input: TdeeInput): TdeeResult {
  const { days, profile, latestWeightKg } = input;
  const age = ageFrom(profile.birthDate);
  const bmr = latestWeightKg != null && profile.heightCm != null && age != null
    ? mifflinStJeor(latestWeightKg, profile.heightCm, age, profile.sex)
    : null;

  // --- 活動ベース ---
  let activity: number | null = null;
  if (bmr != null && days.length > 0) {
    const daily: number[] = [];
    for (const d of days) {
      const dit = (d.intakeKcal ?? 0) * 0.10;
      if (d.activeEnergy != null && d.activeEnergy > 0) {
        daily.push(bmr + d.activeEnergy + dit);
      } else {
        const neat = (d.steps ?? 0) * 0.04;
        const exercise = d.workoutCount * 250;
        daily.push(bmr + neat + exercise + dit);
      }
    }
    activity = Math.round(daily.reduce((a, b) => a + b, 0) / daily.length);
  }

  // --- 逆算ベース ---
  const logged = days.filter((d) => d.intakeKcal != null && d.intakeKcal > 0);
  let reverse: number | null = null;
  if (logged.length >= 14) {
    const avgIntake = logged.reduce((a, d) => a + (d.intakeKcal ?? 0), 0) / logged.length;
    const maPoints = days
      .map((d, i) => (d.weightMA7 != null ? { x: i, y: d.weightMA7 } : null))
      .filter((p): p is { x: number; y: number } => p != null);
    const reg = linearRegression(maPoints);
    if (reg) {
      // 体脂肪1kg ≈ 7200kcal(アプリ全体で統一)。増量中は摂取>TDEE、減量中は摂取<TDEE
      reverse = Math.round(avgIntake - reg.slope * 7200);
    }
  }

  return {
    activity,
    reverse,
    effective: reverse ?? activity,
    bmr,
    loggedDays: logged.length,
  };
}
