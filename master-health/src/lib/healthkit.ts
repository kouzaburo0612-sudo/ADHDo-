/**
 * HealthKit取得層 (@kingstinct/react-native-healthkit v14 / Nitro Modules)
 *
 * Withings・Ouraが書き込んだApple Healthデータを日次集計して返す。
 * - 累積量(歩数・カロリー)は statistics collection の cumulativeSum を使う
 *   (iPhoneとWatch等の重複ソースをHealthKit側でデデュープさせるため)
 * - 測定量(HRV・心拍・呼吸・体表温)は discreteAverage の日次平均
 * - 体組成(体重・体脂肪率・除脂肪体重)はサンプルを直接取得し「その日の最後の値」
 * - 睡眠はカテゴリサンプルをステージ別に合算(18時境界で「その晩」に割り付け)
 *
 * 注意: HealthKitには「骨量」「体水分」のデータ型が存在しないため対象外
 * (Withings公式アプリ内のみの値)。筋肉量は除脂肪体重(LeanBodyMass)で代替。
 */
import {
  CategoryValueSleepAnalysis,
  isHealthDataAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
} from '@kingstinct/react-native-healthkit';
import type { ObjectTypeIdentifier } from '@kingstinct/react-native-healthkit';

import { toKey, addDays } from '@/lib/dates';
import type { MetricKey } from '@/lib/metrics';
import type { MetricRow } from '@/lib/db';

/** 読み取り許可を求める型一覧 */
export const READ_TYPES = [
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierWalkingHeartRateAverage',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierFlightsClimbed',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const satisfies readonly ObjectTypeIdentifier[];

export function healthAvailable(): boolean {
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}

type QuantityId = (typeof READ_TYPES)[number];

/** scale: HealthKitの返り値に掛ける倍率(%単位は0〜1の小数で返るため100倍する等) */
interface CumulativeSpec { metric: MetricKey; id: QuantityId; unit: string; scale?: number }
interface AverageSpec { metric: MetricKey; id: QuantityId; unit: string; scale?: number }
interface SampleSpec { metric: MetricKey; id: QuantityId; unit: string; scale?: number }

const CUMULATIVE: CumulativeSpec[] = [
  { metric: 'steps', id: 'HKQuantityTypeIdentifierStepCount', unit: 'count' },
  { metric: 'active_energy', id: 'HKQuantityTypeIdentifierActiveEnergyBurned', unit: 'kcal' },
  { metric: 'basal_energy', id: 'HKQuantityTypeIdentifierBasalEnergyBurned', unit: 'kcal' },
  { metric: 'distance', id: 'HKQuantityTypeIdentifierDistanceWalkingRunning', unit: 'm', scale: 0.001 },
  { metric: 'flights', id: 'HKQuantityTypeIdentifierFlightsClimbed', unit: 'count' },
  { metric: 'exercise_time', id: 'HKQuantityTypeIdentifierAppleExerciseTime', unit: 'min' },
];

const AVERAGED: AverageSpec[] = [
  { metric: 'hrv', id: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', unit: 'ms' },
  { metric: 'rhr', id: 'HKQuantityTypeIdentifierRestingHeartRate', unit: 'count/min' },
  { metric: 'heart_rate', id: 'HKQuantityTypeIdentifierHeartRate', unit: 'count/min' },
  { metric: 'walking_hr', id: 'HKQuantityTypeIdentifierWalkingHeartRateAverage', unit: 'count/min' },
  { metric: 'spo2', id: 'HKQuantityTypeIdentifierOxygenSaturation', unit: '%', scale: 100 },
  { metric: 'vo2max', id: 'HKQuantityTypeIdentifierVO2Max', unit: 'mL/(kg*min)' },
  { metric: 'resp_rate', id: 'HKQuantityTypeIdentifierRespiratoryRate', unit: 'count/min' },
  { metric: 'wrist_temp', id: 'HKQuantityTypeIdentifierAppleSleepingWristTemperature', unit: 'degC' },
];

const BODY_SAMPLES: SampleSpec[] = [
  { metric: 'weight', id: 'HKQuantityTypeIdentifierBodyMass', unit: 'kg' },
  { metric: 'body_fat', id: 'HKQuantityTypeIdentifierBodyFatPercentage', unit: '%', scale: 100 },
  { metric: 'lean_mass', id: 'HKQuantityTypeIdentifierLeanBodyMass', unit: 'kg' },
  { metric: 'bmi', id: 'HKQuantityTypeIdentifierBodyMassIndex', unit: 'count' },
];

/** startDate〜今日の全指標を日次集計して返す */
export async function fetchDailyMetrics(startDate: Date): Promise<MetricRow[]> {
  const endDate = new Date();
  const rows: MetricRow[] = [];
  const anchor = new Date(startDate);
  anchor.setHours(0, 0, 0, 0);
  const dateFilter = { date: { startDate: anchor, endDate } };

  // 累積量: 日次合計
  for (const spec of CUMULATIVE) {
    try {
      const stats = await queryStatisticsCollectionForQuantity(
        spec.id as never, ['cumulativeSum'], anchor, { day: 1 }, { filter: dateFilter, unit: spec.unit as never },
      );
      for (const s of stats) {
        const v = s.sumQuantity?.quantity;
        if (v != null && v > 0 && s.startDate) {
          rows.push({ date: toKey(new Date(s.startDate)), metric: spec.metric, value: v * (spec.scale ?? 1) });
        }
      }
    } catch (e) {
      console.warn(`HK fetch failed: ${spec.metric}`, e);
    }
  }

  // 測定量: 日次平均
  for (const spec of AVERAGED) {
    try {
      const stats = await queryStatisticsCollectionForQuantity(
        spec.id as never, ['discreteAverage'], anchor, { day: 1 }, { filter: dateFilter, unit: spec.unit as never },
      );
      for (const s of stats) {
        const v = s.averageQuantity?.quantity;
        if (v != null && s.startDate) {
          rows.push({ date: toKey(new Date(s.startDate)), metric: spec.metric, value: v * (spec.scale ?? 1) });
        }
      }
    } catch (e) {
      console.warn(`HK fetch failed: ${spec.metric}`, e);
    }
  }

  // 体組成: その日の最後のサンプル
  for (const spec of BODY_SAMPLES) {
    try {
      const samples = await queryQuantitySamples(spec.id as never, {
        limit: -1,
        ascending: true,
        unit: spec.unit as never,
        filter: dateFilter,
      });
      const byDay = new Map<string, number>();
      for (const s of samples) {
        // HealthKitの'%'単位は0〜1の小数で返る(0.202 = 20.2%)ためscale=100を掛ける
        byDay.set(toKey(new Date(s.startDate)), s.quantity * (spec.scale ?? 1)); // 昇順なので最後の値が残る
      }
      for (const [date, value] of byDay) rows.push({ date, metric: spec.metric, value });
    } catch (e) {
      console.warn(`HK fetch failed: ${spec.metric}`, e);
    }
  }

  // 睡眠
  try {
    rows.push(...await fetchSleep(anchor, endDate));
  } catch (e) {
    console.warn('HK fetch failed: sleep', e);
  }

  return rows;
}

/**
 * 睡眠の日次集計。
 * サンプル終了時刻が18時より前ならその日、18時以降なら翌日の睡眠として扱う
 * (夜更かし・昼寝を「その晩の睡眠」にまとめる一般的な方法)。
 */
async function fetchSleep(startDate: Date, endDate: Date): Promise<MetricRow[]> {
  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: -1,
    ascending: true,
    filter: { date: { startDate, endDate } },
  });

  const byDay = new Map<string, { deep: number; rem: number; core: number; other: number }>();
  for (const s of samples) {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    const minutes = (end.getTime() - start.getTime()) / 60000;
    if (minutes <= 0) continue;

    const v = s.value as number;
    if (v === CategoryValueSleepAnalysis.inBed || v === CategoryValueSleepAnalysis.awake) continue;

    const day = end.getHours() >= 18 ? toKey(addDays(end, 1)) : toKey(end);
    const acc = byDay.get(day) ?? { deep: 0, rem: 0, core: 0, other: 0 };
    if (v === CategoryValueSleepAnalysis.asleepDeep) acc.deep += minutes;
    else if (v === CategoryValueSleepAnalysis.asleepREM) acc.rem += minutes;
    else if (v === CategoryValueSleepAnalysis.asleepCore) acc.core += minutes;
    else acc.other += minutes; // asleepUnspecified
    byDay.set(day, acc);
  }

  const rows: MetricRow[] = [];
  for (const [date, a] of byDay) {
    const total = a.deep + a.rem + a.core + a.other;
    if (total < 30) continue; // 30分未満はノイズとして無視
    rows.push({ date, metric: 'sleep_total', value: total });
    if (a.deep > 0) rows.push({ date, metric: 'sleep_deep', value: a.deep });
    if (a.rem > 0) rows.push({ date, metric: 'sleep_rem', value: a.rem });
    if (a.core > 0) rows.push({ date, metric: 'sleep_core', value: a.core });
  }
  return rows;
}
