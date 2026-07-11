/**
 * カロリー収支エンジン + カロリー貯金(ゲーム化)
 * ================================================
 * - 日次収支 balance = 摂取kcal − 消費kcal。負なら「赤字」(痩せる方向=良い)
 * - 消費は活動ベースTDEEの日次版: BMR + active_energy + DIT(摂取×0.10)
 *   (active_energyが無い日は BMR + 歩数×0.04 + DIT)
 * - カロリー貯金 = 目標開始日以降の赤字の累積。7,200kcal ≈ 脂肪1kg として換算し、
 *   目標達成に必要な総赤字に対する進捗を出す
 * - chat.ts から参照されるため、このファイルは chat.ts に依存しない
 */
import { getRange } from '@/lib/db';
import { addDays, toKey } from '@/lib/dates';
import {
  dailyIntake, getGoalPlan, getProfile,
  type GoalPlan, type UserProfile,
} from '@/lib/store';
import { ageFrom, mifflinStJeor } from '@/utils/tdee';

/** 脂肪1kgあたりのエネルギー(kcal)。表示・換算用 */
export const KCAL_PER_KG_FAT = 7200;

export interface DayBalance {
  date: string;
  /** その日の摂取kcal(食事記録なしはnull) */
  intake: number | null;
  /** その日の推定消費kcal(プロファイル不足はnull) */
  burn: number | null;
  /** 摂取 − 消費。負=赤字(良い)。どちらか欠けるとnull */
  balance: number | null;
}

/** 直近days日の日次収支(日付昇順、今日を含む) */
export async function balanceSeries(days: number): Promise<DayBalance[]> {
  const today = new Date();
  const profile = await getProfile();
  const age = ageFrom(profile.birthDate);
  const from = addDays(today, -(days + 10)); // 体重のcarry-forward用に余分に取る
  const metricMap = await getRange(toKey(from), toKey(today));
  const intakeMap = await dailyIntake(from.toISOString(), today.toISOString());

  const out: DayBalance[] = [];
  let lastWeight: number | null = null;
  for (let i = days + 10; i >= 0; i--) {
    const key = toKey(addDays(today, -i));
    const m = metricMap.get(key) ?? {};
    if (m.weight != null) lastWeight = m.weight;
    if (i > days - 1) continue;

    const intakeRaw = intakeMap.get(key)?.kcal;
    const intake = intakeRaw != null && intakeRaw > 0 ? Math.round(intakeRaw) : null;

    let burn: number | null = null;
    if (lastWeight != null && profile.heightCm != null && age != null) {
      const bmr = mifflinStJeor(lastWeight, profile.heightCm, age, profile.sex);
      const dit = (intake ?? 0) * 0.10;
      burn = m.active_energy != null && m.active_energy > 0
        ? Math.round(bmr + m.active_energy + dit)
        : Math.round(bmr + (m.steps ?? 0) * 0.04 + dit);
    }

    out.push({
      date: key,
      intake,
      burn,
      balance: intake != null && burn != null ? intake - burn : null,
    });
  }
  return out;
}

export interface BankSummary {
  /** 累積赤字kcal(正=貯金あり)。黒字日は差し引く */
  bankedKcal: number;
  /** 集計対象になった日数(食事記録がある日のみ) */
  countedDays: number;
  /** 脂肪換算(kg) */
  fatKgEquivalent: number;
  /** 連続赤字日数(今日または昨日から遡る) */
  streakDays: number;
  /** 目標達成に必要な総赤字kcal(目標未設定はnull) */
  neededKcal: number | null;
  /** 0〜1。目標未設定はnull */
  progress: number | null;
}

/**
 * カロリー赤字の累積を集計する。目標開始日(なければ直近90日)以降が対象。
 * @param untilKey この日付「時点まで」の累積にする(省略時は今日まで)。
 *                 My Bodyで過去日を見たとき、その日時点の値を出すために使う。
 */
export async function calorieBank(untilKey?: string): Promise<BankSummary> {
  const plan = await getGoalPlan();
  const today = new Date();
  const endKey = untilKey ?? toKey(today);
  const startKey = plan.startDate ?? toKey(addDays(today, -90));
  const span = Math.max(1, Math.min(400,
    Math.round((today.getTime() - new Date(startKey).getTime()) / 86400000) + 1));
  const upto = (await balanceSeries(span)).filter((d) => d.date <= endKey);

  let banked = 0;
  let counted = 0;
  for (const d of upto) {
    if (d.date < startKey || d.balance == null) continue;
    banked += -d.balance; // 赤字(負のbalance)を正の累積として積む
    counted++;
  }

  // ストリーク: 末尾(対象日)から遡って赤字が続く日数。対象日が未記録ならスキップして前日から
  let streak = 0;
  for (let i = upto.length - 1; i >= 0; i--) {
    const d = upto[i];
    if (i === upto.length - 1 && d.balance == null) continue;
    if (d.balance != null && d.balance < 0) streak++;
    else break;
  }

  const needed = plan.targetWeightKg != null && plan.startWeightKg != null && plan.startWeightKg > plan.targetWeightKg
    ? (plan.startWeightKg - plan.targetWeightKg) * KCAL_PER_KG_FAT
    : null;

  return {
    bankedKcal: Math.round(banked),
    countedDays: counted,
    fatKgEquivalent: Math.round((banked / KCAL_PER_KG_FAT) * 100) / 100,
    streakDays: streak,
    neededKcal: needed,
    progress: needed != null && needed > 0 ? Math.max(0, Math.min(1, banked / needed)) : null,
  };
}

export interface GoalNumbers {
  plan: GoalPlan;
  profile: UserProfile;
  /** 直近の体重(kg)・体脂肪率(%) */
  currentWeightKg: number | null;
  currentBodyFatPct: number | null;
  /** 目標まで落とす脂肪量(kg)。優先指標(体脂肪率 or 体重)から換算 */
  remainingKg: number | null;
  /** 目標日まで残り日数 */
  daysLeft: number | null;
  /** 必要ペース(kg/週) */
  paceKgPerWeek: number | null;
  /** 必要な1日あたり赤字(kcal) */
  requiredDailyDeficit: number | null;
  /** 平均消費(活動ベースTDEEの14日平均) */
  avgBurn: number | null;
  /** 基礎代謝(これを下回る摂取目標は警告する) */
  bmr: number | null;
  /** 目標摂取カロリー(auto=消費−必要赤字 / custom=手入力) */
  targetIntakeKcal: number | null;
  /** PFC目標グラム */
  pfcGrams: { p: number; f: number; c: number } | null;
}

/** 目標設定カードに出す数値一式 */
export async function goalNumbers(): Promise<GoalNumbers> {
  const plan = await getGoalPlan();
  const profile = await getProfile();
  const today = new Date();

  const metricMap = await getRange(toKey(addDays(today, -14)), toKey(today));
  let currentWeightKg: number | null = null;
  let currentBodyFatPct: number | null = null;
  for (const [, day] of metricMap) {
    if (day.weight != null) currentWeightKg = day.weight;
    if (day.body_fat != null) currentBodyFatPct = day.body_fat;
  }

  const series = await balanceSeries(14);
  const burns = series.map((d) => d.burn).filter((b): b is number => b != null);
  const avgBurn = burns.length ? Math.round(burns.reduce((a, b) => a + b, 0) / burns.length) : null;

  const age = ageFrom(profile.birthDate);
  const bmr = currentWeightKg != null && profile.heightCm != null && age != null
    ? mifflinStJeor(currentWeightKg, profile.heightCm, age, profile.sex)
    : null;

  // 優先指標に応じて「落とす脂肪量」を求める
  // 体脂肪率優先: 体重×(現在% − 目標%)/100 ≒ 落とす脂肪kg(除脂肪量一定の近似)
  let remainingKg: number | null = null;
  const useBodyFat = plan.priority === 'body_fat'
    && plan.targetBodyFatPct != null && currentBodyFatPct != null && currentWeightKg != null;
  if (useBodyFat) {
    remainingKg = Math.round(currentWeightKg! * (currentBodyFatPct! - plan.targetBodyFatPct!) / 100 * 10) / 10;
  } else if (plan.targetWeightKg != null && currentWeightKg != null) {
    remainingKg = Math.round((currentWeightKg - plan.targetWeightKg) * 10) / 10;
  }

  let daysLeft: number | null = null;
  let paceKgPerWeek: number | null = null;
  let requiredDailyDeficit: number | null = null;
  if (remainingKg != null && plan.targetDate) {
    daysLeft = Math.max(0, Math.ceil((new Date(plan.targetDate).getTime() - today.getTime()) / 86400000));
    if (daysLeft > 0 && remainingKg > 0) {
      paceKgPerWeek = Math.round((remainingKg / daysLeft) * 7 * 100) / 100;
      requiredDailyDeficit = Math.round((remainingKg * KCAL_PER_KG_FAT) / daysLeft);
    }
  }

  let targetIntakeKcal: number | null = null;
  if (plan.intakeMode === 'custom' && plan.customIntakeKcal != null) {
    targetIntakeKcal = plan.customIntakeKcal;
  } else if (avgBurn != null) {
    targetIntakeKcal = Math.max(1200, avgBurn - (requiredDailyDeficit ?? 0));
  }

  const pfcGrams = targetIntakeKcal != null
    ? {
        p: Math.round((targetIntakeKcal * plan.pfc.p) / 100 / 4),
        f: Math.round((targetIntakeKcal * plan.pfc.f) / 100 / 9),
        c: Math.round((targetIntakeKcal * plan.pfc.c) / 100 / 4),
      }
    : null;

  return {
    plan, profile, currentWeightKg, currentBodyFatPct, remainingKg, daysLeft,
    paceKgPerWeek, requiredDailyDeficit, avgBurn, bmr, targetIntakeKcal, pfcGrams,
  };
}
