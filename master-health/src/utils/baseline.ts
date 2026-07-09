/**
 * ベースライン異常検知と目標到達予測
 *
 * 異常検知: 体表温・HRV・安静時心拍について、過去60日の平常範囲(平均±σ)から
 * |z| >= 1.5 逸脱した日を「体調変化の兆候」として警告する。
 * 1.5σは「めったに出ないが、風邪の前日などには実際に出る」水準として選択。
 */
import { fromKey, toKey, addDays } from '@/lib/dates';
import { formatValue, METRICS, type MetricKey } from '@/lib/metrics';
import { linearRegression, zScore } from '@/utils/stats';

export interface Anomaly {
  metric: MetricKey;
  z: number;
  message: string;
}

const WATCHED: { key: MetricKey; up: string; down: string }[] = [
  { key: 'wrist_temp', up: '体表温がいつもより高めです。体調変化の兆候かもしれません。', down: '体表温がいつもより低めです。測定環境の変化がなければ様子を見てください。' },
  { key: 'hrv',        up: 'HRVがいつもより大きく高い値です。回復が進んでいる可能性があります。', down: 'HRVがいつもより大きく低下しています。ストレスや疲労のサインかもしれません。' },
  { key: 'rhr',        up: '安静時心拍がいつもより高めです。疲労・飲酒・体調変化に心当たりは?', down: '安静時心拍がいつもより低い値です。コンディションが良い可能性があります。' },
];

export function detectAnomalies(
  today: Partial<Record<MetricKey, number>>,
  history: Partial<Record<MetricKey, number[]>>,
): Anomaly[] {
  const out: Anomaly[] = [];
  for (const w of WATCHED) {
    const v = today[w.key];
    const h = history[w.key];
    if (v == null || !h || h.length < 14) continue; // 2週間分未満では判定しない
    const z = zScore(v, h);
    if (z == null || Math.abs(z) < 1.5) continue;
    out.push({ metric: w.key, z, message: z > 0 ? w.up : w.down });
  }
  return out;
}

export interface GoalForecast {
  /** 目標到達の予測日(改善傾向でない場合はnull) */
  date: string | null;
  /** 1日あたりの変化量(体脂肪率: %/日) */
  slopePerDay: number | null;
  current: number;
  diff: number;
}

/**
 * 体脂肪率の目標到達予測。
 * 直近30日の測定値に単回帰を当て、現在のトレンドが続いた場合の到達日を出す。
 * 予測が1年以上先、またはトレンドが横ばい・悪化方向のときはnull。
 */
export function forecastBodyFat(
  series: { date: string; value: number }[],
  goal: number,
): GoalForecast | null {
  if (series.length === 0) return null;
  const latest = series[series.length - 1];
  const diff = latest.value - goal;
  if (diff <= 0) return { date: null, slopePerDay: null, current: latest.value, diff };

  const base = fromKey(series[0].date).getTime();
  const points = series.map((p) => ({
    x: (fromKey(p.date).getTime() - base) / 86400000,
    y: p.value,
  }));
  const reg = linearRegression(points);
  if (!reg || reg.slope >= -0.001) {
    return { date: null, slopePerDay: reg?.slope ?? null, current: latest.value, diff };
  }
  const days = diff / -reg.slope;
  if (days > 365) return { date: null, slopePerDay: reg.slope, current: latest.value, diff };
  return {
    date: toKey(addDays(fromKey(latest.date), Math.ceil(days))),
    slopePerDay: reg.slope,
    current: latest.value,
    diff,
  };
}

// ---- タグ相関分析 ----

export interface TagEffect {
  tag: string;
  /** タグ記録日数 */
  count: number;
  /** 指標ごとの「タグ翌日の平均 − 通常日の平均」 */
  effects: { metric: MetricKey; delta: number; formatted: string }[];
}

const CORRELATION_METRICS: MetricKey[] = ['hrv', 'sleep_deep', 'rhr', 'sleep_total'];

/**
 * タグ相関: 各タグについて「タグを記録した翌日」の指標平均と、
 * それ以外の日の平均との差を出す。因果ではなく傾向の可視化。
 * 3回以上記録されたタグのみ対象(少なすぎる標本は誤解を招くため)。
 */
export function computeTagEffects(
  tagDates: Map<string, string[]>,
  byDate: Map<string, Partial<Record<MetricKey, number>>>,
): TagEffect[] {
  const out: TagEffect[] = [];
  for (const [tag, dates] of tagDates) {
    if (dates.length < 3) continue;
    const nextDays = new Set(dates.map((d) => toKey(addDays(fromKey(d), 1))));
    const effects: TagEffect['effects'] = [];
    for (const metric of CORRELATION_METRICS) {
      const tagged: number[] = [];
      const normal: number[] = [];
      for (const [date, day] of byDate) {
        const v = day[metric];
        if (v == null) continue;
        (nextDays.has(date) ? tagged : normal).push(v);
      }
      if (tagged.length < 3 || normal.length < 7) continue;
      const delta = tagged.reduce((a, b) => a + b, 0) / tagged.length
                  - normal.reduce((a, b) => a + b, 0) / normal.length;
      const def = METRICS[metric];
      const sign = delta >= 0 ? '+' : '−';
      const fmtAbs = def.asDuration
        ? `${Math.round(Math.abs(delta))}分`
        : `${formatValue(metric, Math.abs(delta))}${def.unit}`;
      effects.push({ metric, delta, formatted: `${def.label} ${sign}${fmtAbs}` });
    }
    if (effects.length > 0) out.push({ tag, count: dates.length, effects });
  }
  return out.sort((a, b) => b.count - a.count);
}
