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

export interface TdeeParts {
  bmr: number;
  /** 歩行などの日常活動(歩数×0.04) */
  neat: number;
  /** ワークアウト消費 */
  eat: number;
  /** 食事誘発性熱産生 */
  dit: number;
}

export interface DayBalance {
  date: string;
  /** その日の摂取kcal(食事記録なしはnull) */
  intake: number | null;
  /** その日の推定消費kcal = TDEE(プロファイル不足はnull) */
  burn: number | null;
  /** TDEEの内訳(burnがnullならnull) */
  parts: TdeeParts | null;
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
 *   TDEE = BMR + NEAT + EAT + DIT
 *   - BMR: Mifflin-St Jeor。その日時点の最新体重で毎日動的に計算
 *   - NEAT: その日の実測歩数 × 0.04kcal
 *     (今日は歩数が未確定のため、実測が直近7日平均を下回る間は7日平均で暫定計算)
 *   - EAT: HealthKitのワークアウトサンプルの消費kcal(workout_energy)。
 *     手動トレ記録は簡易換算(筋トレ5kcal/分・有酸素7kcal/分)で加算するが、
 *     同じ日にHealthKitのワークアウトがある場合は二重計上を避けるため手動分は加算しない
 *     (日単位のデデュープ。セッション単位の重複判定は区間データ保持後の課題)
 *   - DIT: 直近7日の平均摂取 × 0.10。摂取記録が3日未満のときは
 *     目標摂取(手入力があればそれ、無ければ維持カロリー近似)× 0.10 で代替。
 *     確定済みの過去日は、その日の実摂取 × 0.10
 */
export async function balanceSeries(days: number): Promise<DayBalance[]> {
  const today = new Date();
  const todayKey = toKey(today);
  const profile = await getProfile();
  const plan = await getGoalPlan();
  const age = ageFrom(profile.birthDate);
  const from = addDays(today, -(days + 10)); // 体重のcarry-forwardと7日平均用に余分に取る
  // 上限は「今日の終わり」まで取る(今晩の食事など、現在時刻より後の記録も当日分に含める)
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const metricMap = await getRange(toKey(from), toKey(today));
  const intakeMap = await dailyIntake(from.toISOString(), dayEnd.toISOString());

  // 手動トレ記録(HealthKitワークアウトが無い日のEATに使う)
  // cardio: 有酸素プリセット(reps=1,sets=1の単一種目)として記録される
  const workoutByDay = new Map<string, { strengthMin: number; cardioMin: number; count: number }>();
  try {
    for (const w of await listWorkoutLogs(from.toISOString(), dayEnd.toISOString())) {
      const k = localDateKey(w.timestamp);
      const acc = workoutByDay.get(k) ?? { strengthMin: 0, cardioMin: 0, count: 0 };
      const isCardio = w.exercises.length === 1 && w.exercises[0].reps === 1 && w.exercises[0].sets === 1;
      const min = w.durationMin ?? 40; // 時間未入力は40分相当とみなす
      if (isCardio) acc.cardioMin += min;
      else acc.strengthMin += min;
      acc.count += 1;
      workoutByDay.set(k, acc);
    }
  } catch { /* トレ記録が読めなくてもTDEEは出す */ }

  // 直近7日(今日を除く)の平均: 暫定計算と DIT に使う
  const avg = (xs: number[]): number | null =>
    xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const steps7: number[] = [];
  const intake7: number[] = [];
  for (let i = 7; i >= 1; i--) {
    const k = toKey(addDays(today, -i));
    const m = metricMap.get(k) ?? {};
    if (m.steps != null && m.steps > 0) steps7.push(m.steps);
    const ik = intakeMap.get(k)?.kcal;
    if (ik != null && ik > 0) intake7.push(ik);
  }
  const avgSteps7 = avg(steps7);
  const avgIntake7 = intake7.length >= 3 ? avg(intake7) : null; // 3日未満は信頼しない

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
    let parts: TdeeParts | null = null;
    let provisional = false;
    if (lastWeight != null && profile.heightCm != null && age != null) {
      const bmr = mifflinStJeor(lastWeight, profile.heightCm, age, profile.sex);

      // NEAT: 歩数×0.04。今日は7日平均で下支え(実測が上回れば実測)
      let steps = m.steps ?? 0;
      if (isToday && avgSteps7 != null && steps < avgSteps7) {
        steps = avgSteps7;
        provisional = true;
      }
      const neat = steps * 0.04;

      // EAT: HealthKitワークアウト優先。無い日のみ手動記録を簡易換算
      let eat = m.workout_energy ?? 0;
      if (eat <= 0) {
        const wk = workoutByDay.get(key);
        if (wk) eat = wk.strengthMin * 5 + wk.cardioMin * 7;
      }

      // DIT: 過去日は実摂取×0.1。今日(未確定)は7日平均、3日未満なら目標摂取で代替
      let ditBase: number;
      if (!isToday && intake != null) {
        ditBase = intake;
      } else if (avgIntake7 != null) {
        ditBase = avgIntake7;
        if (isToday) provisional = true;
      } else {
        // 摂取記録3日未満: 手入力の目標摂取、無ければ維持カロリー近似
        // (TDEE = base + 0.1×TDEE を解くと DIT = base/9)
        ditBase = plan.customIntakeKcal ?? (bmr + neat + eat) / 0.9;
        provisional = provisional || isToday;
      }
      const dit = ditBase * 0.10;

      parts = {
        bmr,
        neat: Math.round(neat),
        eat: Math.round(eat),
        dit: Math.round(dit),
      };
      burn = Math.round(bmr + neat + eat + dit);
    }

    out.push({
      date: key,
      intake,
      burn,
      parts,
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
 * カロリー赤字の累積を集計する。記録があるすべての日(直近400日)が対象で、
 * 目標を編集してもリセットされない(v3.6までは目標編集で起点が今日に戻り、
 * 前日以前の赤字が消えて見えるバグがあった)。
 * 進捗バーは「現在の体組成から目標までに必要な残り赤字」を基準にする:
 *   目標まで = 残り必要赤字 / 達成率 = 累積 ÷ (累積 + 残り必要赤字)
 * @param untilKey この日付「時点まで」の累積にする(省略時は今日まで)。
 *                 My Bodyで過去日を見たとき、その日時点の値を出すために使う。
 */
export async function calorieBank(untilKey?: string): Promise<BankSummary> {
  const today = new Date();
  const endKey = untilKey ?? toKey(today);
  const upto = (await balanceSeries(400)).filter((d) => d.date <= endKey);

  let banked = 0;
  let counted = 0;
  for (const d of upto) {
    if (d.balance == null) continue;
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

  // 残り必要赤字は「今の体組成 → 目標」から算出(過去の起点体重に依存しない)
  let needed: number | null = null;
  try {
    const g = await goalNumbers();
    if (g.remainingKg != null) {
      needed = Math.round(banked) + Math.max(0, Math.round(g.remainingKg * KCAL_PER_KG_FAT));
    }
  } catch { /* 目標未設定なら進捗バーなし */ }

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
  /** 基礎代謝(目標摂取の下限) */
  bmr: number | null;
  /** 目標摂取カロリー(auto=消費−必要赤字、BMRを下限にクランプ / custom=手入力) */
  targetIntakeKcal: number | null;
  /** 目標摂取がBMRでクランプされた(=期日どおりの達成は不可能) */
  intakeClamped: boolean;
  /** BMR摂取を続けた場合の達成可能日(クランプ時のみ) */
  achievableDate: string | null;
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

  // 優先指標に応じて「落とす脂肪量」を求める。
  // 体脂肪率優先の場合、目標体重は逆算に一切使わない(参考表示のみ)。
  // 落とす脂肪 = 体重 × (現在BF − 目標BF) / (1 − 目標BF)
  // (除脂肪体重を維持したまま目標体脂肪率に達すると仮定した式)
  let remainingKg: number | null = null;
  const useBodyFat = plan.priority === 'body_fat'
    && plan.targetBodyFatPct != null && currentBodyFatPct != null && currentWeightKg != null;
  if (useBodyFat) {
    const bf = currentBodyFatPct! / 100;
    const t = plan.targetBodyFatPct! / 100;
    remainingKg = Math.round(currentWeightKg! * (bf - t) / (1 - t) * 10) / 10;
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

  // 目標摂取。計算上BMRを下回る場合はBMRを下限にクランプし、
  // その摂取で実現できる「達成可能日」を併せて出す(期日どおりは不可能と正直に示す)
  let targetIntakeKcal: number | null = null;
  let intakeClamped = false;
  let achievableDate: string | null = null;
  if (plan.intakeMode === 'custom' && plan.customIntakeKcal != null) {
    targetIntakeKcal = plan.customIntakeKcal;
  } else if (avgBurn != null) {
    const raw = avgBurn - (requiredDailyDeficit ?? 0);
    if (bmr != null && raw < bmr) {
      targetIntakeKcal = bmr;
      intakeClamped = true;
      const sustainableDeficit = avgBurn - bmr;
      if (remainingKg != null && remainingKg > 0 && sustainableDeficit > 0) {
        const daysNeeded = Math.ceil((remainingKg * KCAL_PER_KG_FAT) / sustainableDeficit);
        achievableDate = toKey(addDays(today, daysNeeded));
      }
    } else {
      targetIntakeKcal = Math.max(1200, Math.round(raw));
    }
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
    paceKgPerWeek, requiredDailyDeficit, avgBurn, bmr, targetIntakeKcal,
    intakeClamped, achievableDate, pfcGrams,
  };
}
