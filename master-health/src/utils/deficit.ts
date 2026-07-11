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
  dailyIntake, getGoalPlan, getProfile, listWorkoutLogs, localDateKey,
  type GoalPlan, type UserProfile,
} from '@/lib/store';
import { ageFrom, mifflinStJeor } from '@/utils/tdee';

/** 脂肪1kgあたりのエネルギー(kcal)。表示・換算用 */
export const KCAL_PER_KG_FAT = 7200;

export interface DayBalance {
  date: string;
  /** その日の摂取kcal(食事記録なしはnull) */
  intake: number | null;
  /** その日の推定消費kcal = TDEE(プロファイル不足はnull) */
  burn: number | null;
  /** 摂取 − 消費。負=赤字(良い)。どちらか欠けるとnull */
  balance: number | null;
  /**
   * 暫定値フラグ。今日はまだ歩数・摂取が確定していないため、
   * 7日平均で補完した暫定TDEEになる(1日が終われば実測で確定)
   */
  provisional: boolean;
}

/**
 * 直近days日の日次収支(日付昇順、今日を含む)。
 *
 * 消費(TDEE)の計算式:
 *   TDEE = BMR + 活動 + 運動 + DIT
 *   - BMR: Mifflin-St Jeor。その日時点の最新体重で毎日動的に計算
 *   - 活動: HealthKitのactive_energy(NEAT+運動込み)を優先。
 *     無い日は NEAT = 歩数 × 0.04kcal で近似
 *   - 運動: active_energyが無い日のみ、トレ記録から加算(時間×6kcal/分、無ければ1回250kcal)
 *   - DIT(食事誘発性熱産生): 摂取kcal × 0.10
 *   今日はまだ数値が確定していないため、歩数・活動・摂取(DIT用)を
 *   「max(現時点の実測, 直近7日平均)」で補完した暫定TDEEを返す(provisional=true)。
 */
export async function balanceSeries(days: number): Promise<DayBalance[]> {
  const today = new Date();
  const todayKey = toKey(today);
  const profile = await getProfile();
  const age = ageFrom(profile.birthDate);
  const from = addDays(today, -(days + 10)); // 体重のcarry-forwardと7日平均用に余分に取る
  const metricMap = await getRange(toKey(from), toKey(today));
  const intakeMap = await dailyIntake(from.toISOString(), today.toISOString());

  // 手動トレ記録(active_energyが無い日の運動消費に使う)
  const workoutByDay = new Map<string, { count: number; min: number }>();
  try {
    for (const w of await listWorkoutLogs(from.toISOString(), today.toISOString())) {
      const k = localDateKey(w.timestamp);
      const acc = workoutByDay.get(k) ?? { count: 0, min: 0 };
      acc.count += 1;
      acc.min += w.durationMin ?? 0;
      workoutByDay.set(k, acc);
    }
  } catch { /* トレ記録が読めなくてもTDEEは出す */ }

  // 直近7日(今日を除く)の平均: 今日の暫定補完に使う
  const avg = (xs: number[]): number | null =>
    xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const steps7: number[] = [];
  const active7: number[] = [];
  const intake7: number[] = [];
  for (let i = 7; i >= 1; i--) {
    const k = toKey(addDays(today, -i));
    const m = metricMap.get(k) ?? {};
    if (m.steps != null && m.steps > 0) steps7.push(m.steps);
    if (m.active_energy != null && m.active_energy > 0) active7.push(m.active_energy);
    const ik = intakeMap.get(k)?.kcal;
    if (ik != null && ik > 0) intake7.push(ik);
  }
  const avgSteps7 = avg(steps7);
  const avgActive7 = avg(active7);
  const avgIntake7 = avg(intake7);

  const out: DayBalance[] = [];
  let lastWeight: number | null = null;
  for (let i = days + 10; i >= 0; i--) {
    const key = toKey(addDays(today, -i));
    const m = metricMap.get(key) ?? {};
    if (m.weight != null) lastWeight = m.weight;
    if (i > days - 1) continue;

    const isToday = key === todayKey;
    const intakeRaw = intakeMap.get(key)?.kcal;
    const intake = intakeRaw != null && intakeRaw > 0 ? Math.round(intakeRaw) : null;

    let burn: number | null = null;
    let provisional = false;
    if (lastWeight != null && profile.heightCm != null && age != null) {
      const bmr = mifflinStJeor(lastWeight, profile.heightCm, age, profile.sex);

      // 今日は実測がまだ積み上がっていないため7日平均で下支えする
      let steps = m.steps ?? 0;
      let active = m.active_energy ?? 0;
      let ditIntake = intake ?? 0;
      if (isToday) {
        if (avgSteps7 != null && steps < avgSteps7) { steps = Math.max(steps, avgSteps7); provisional = true; }
        if (avgActive7 != null && active < avgActive7) { active = Math.max(active, avgActive7); provisional = true; }
        if (intake == null && avgIntake7 != null) { ditIntake = avgIntake7; provisional = true; }
        if (intake != null && avgIntake7 != null && intake < avgIntake7) { ditIntake = avgIntake7; provisional = true; }
      }

      const dit = ditIntake * 0.10;
      if (active > 50) {
        // active_energyはNEAT+運動込みの実測。これを最優先
        burn = Math.round(bmr + active + dit);
      } else {
        const wk = workoutByDay.get(key);
        const workoutKcal = wk ? (wk.min > 0 ? wk.min * 6 : wk.count * 250) : 0;
        burn = Math.round(bmr + steps * 0.04 + workoutKcal + dit);
      }
    }

    out.push({
      date: key,
      intake,
      burn,
      balance: intake != null && burn != null ? intake - burn : null,
      provisional,
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
