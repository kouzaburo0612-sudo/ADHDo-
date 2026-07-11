/**
 * 目標達成予測(カロリー赤字プラン基準)
 * ======================================
 * 体重の傾き外挿(データが少ないと「2027年達成」のような絶望的な予測になる)ではなく、
 * 「期日までに必要な総赤字 ÷ 残り日数 = 必要赤字/日」を軸に、
 * 直近の実績赤字と比べて達成見込みを出す。
 * - このままのペースなら◯月◯日達成(直近7日の平均赤字ペースで外挿)
 * - 期日に間に合う確率(実績赤字/必要赤字の比率から推定)
 * 記録が少なくても「今日からどうすればいいか」が見える形にする。
 */
import { getSeries } from '@/lib/db';
import { addDays, toKey } from '@/lib/dates';
import { balanceSeries, goalNumbers, KCAL_PER_KG_FAT } from '@/utils/deficit';
import { linearRegression, mean } from '@/utils/stats';

export interface PlanForecast {
  hasPlan: boolean;
  /** 優先指標の表示(体脂肪率 17.2% → 13.5% など) */
  metricLabel: string;
  currentText: string | null;
  targetText: string | null;
  deadline: string | null;
  /** 目標までに必要な総赤字kcal */
  remainingKcal: number | null;
  /** 期日から逆算した必要赤字/日 */
  requiredDailyDeficit: number | null;
  /** 直近7日の平均赤字/日(記録がある日のみ。黒字はマイナス) */
  avgDailyDeficit: number | null;
  /** 直近7日のうち必要赤字を達成した日数と記録日数 */
  achievedDays: number;
  loggedDays: number;
  /** このままの実績ペースで達成する日(YYYY-MM-DD)。ペースが出ていなければnull */
  projectedDate: string | null;
  /** 予測の主軸: weight_trend=体重7日移動平均の傾き / deficit=カロリー収支 */
  projectionBasis: 'weight_trend' | 'deficit' | null;
  /** 期日に間に合う確率(5〜99%)。データ7日未満はnull */
  onTrackProbability: number | null;
  /** 確率が参考値(データ14日未満)かどうか */
  probabilityIsReference: boolean;
  /** データ不足(7日未満)で信頼度が低い */
  lowConfidence: boolean;
  /** 期日達成に足りない赤字/日(実績が足りている場合はnull) */
  extraNeededPerDay: number | null;
}

export async function planForecast(): Promise<PlanForecast> {
  const g = await goalNumbers();
  const plan = g.plan;

  const useBodyFat = plan.priority === 'body_fat' && plan.targetBodyFatPct != null;
  const metricLabel = useBodyFat ? '体脂肪率' : '体重';
  const currentText = useBodyFat
    ? (g.currentBodyFatPct != null ? `${g.currentBodyFatPct.toFixed(1)}%` : null)
    : (g.currentWeightKg != null ? `${g.currentWeightKg.toFixed(1)}kg` : null);
  const targetText = useBodyFat
    ? (plan.targetBodyFatPct != null ? `${plan.targetBodyFatPct}%` : null)
    : (plan.targetWeightKg != null ? `${plan.targetWeightKg}kg` : null);

  const hasPlan = g.remainingKg != null && plan.targetDate != null;
  if (!hasPlan) {
    return {
      hasPlan: false, metricLabel, currentText, targetText, deadline: plan.targetDate,
      remainingKcal: null, requiredDailyDeficit: null, avgDailyDeficit: null,
      achievedDays: 0, loggedDays: 0, projectedDate: null, projectionBasis: null,
      onTrackProbability: null, probabilityIsReference: false, lowConfidence: true,
      extraNeededPerDay: null,
    };
  }

  const remainingKcal = Math.max(0, Math.round(g.remainingKg! * KCAL_PER_KG_FAT));
  const required = g.requiredDailyDeficit;

  // 直近7日の実績赤字(記録がある日のみ)
  const series = (await balanceSeries(7)).filter((d) => d.balance != null);
  const loggedDays = series.length;
  const deficits = series.map((d) => -d.balance!); // 正=赤字
  const avg = loggedDays > 0 ? Math.round(deficits.reduce((a, b) => a + b, 0) / loggedDays) : null;
  const achievedDays = required != null
    ? deficits.filter((d) => d >= required).length
    : deficits.filter((d) => d > 0).length;

  // 「このままのペースなら」— 主軸は体重7日移動平均の傾き(単日の収支に過剰反応しない)。
  // 体重データが足りないときだけカロリー収支ペースで代替する。
  let projectedDate: string | null = null;
  let projectionBasis: PlanForecast['projectionBasis'] = null;
  try {
    const today = new Date();
    const weights = await getSeries('weight', toKey(addDays(today, -28)), toKey(today));
    if (weights.length >= 7) {
      // 7日移動平均系列を作り、最小二乗で傾き(kg/日)を出す
      const ma: { x: number; y: number }[] = [];
      const vals: number[] = [];
      weights.forEach((w, i) => {
        vals.push(w.value);
        const window = vals.slice(-7);
        if (window.length >= 3) ma.push({ x: i, y: mean(window) ?? w.value });
      });
      const reg = linearRegression(ma);
      if (reg && reg.slope < -0.005 && g.remainingKg! > 0) {
        const days = Math.ceil(g.remainingKg! / -reg.slope);
        if (days <= 365 * 3) {
          projectedDate = toKey(addDays(today, days));
          projectionBasis = 'weight_trend';
        }
      }
    }
  } catch { /* 体重系列が読めなければ収支ベースへ */ }

  if (projectedDate == null && avg != null && avg > 0 && remainingKcal > 0) {
    const days = Math.ceil(remainingKcal / avg);
    if (days <= 365 * 3) {
      projectedDate = toKey(addDays(new Date(), days));
      projectionBasis = 'deficit';
    }
  }
  if (remainingKcal === 0) projectedDate = toKey(new Date());

  // 期日達成確率: 実績/必要の比率から。データ7日未満は出さない(過学習防止)、
  // 14日未満は「参考値」として扱う
  const lowConfidence = loggedDays < 7;
  let probability: number | null = null;
  if (!lowConfidence && required != null && required > 0) {
    if (remainingKcal === 0) probability = 99;
    else if (avg != null) {
      const ratio = avg / required;
      probability = Math.max(5, Math.min(95, Math.round(10 + ratio * 75)));
      if (ratio >= 1.3) probability = 95;
    }
  }
  const probabilityIsReference = loggedDays < 14;

  const extraNeededPerDay = required != null && avg != null && avg < required
    ? Math.max(0, Math.round(required - avg))
    : null;

  return {
    hasPlan: true, metricLabel, currentText, targetText,
    deadline: plan.targetDate,
    remainingKcal, requiredDailyDeficit: required,
    avgDailyDeficit: avg, achievedDays, loggedDays,
    projectedDate, projectionBasis,
    onTrackProbability: probability, probabilityIsReference, lowConfidence,
    extraNeededPerDay,
  };
}
