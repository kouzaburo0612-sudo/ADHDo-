/** 取得・表示する全指標の定義 */

export type MetricKey =
  | 'weight'
  | 'body_fat'
  | 'lean_mass'
  | 'sleep_total'
  | 'sleep_deep'
  | 'sleep_rem'
  | 'sleep_core'
  | 'hrv'
  | 'rhr'
  | 'resp_rate'
  | 'wrist_temp'
  | 'steps'
  | 'active_energy';

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  decimals: number;
  /** true=高いほど良い / false=低いほど良い / null=方向なし */
  higherIsBetter: boolean | null;
  /** 日次集計方法: sum=合計, avg=平均, last=その日の最後の値 */
  aggregation: 'sum' | 'avg' | 'last';
  /** 分表示(睡眠系)を "7h32m" 形式にする */
  asDuration?: boolean;
}

export const METRICS: Record<MetricKey, MetricDef> = {
  weight:        { key: 'weight',        label: '体重',        unit: 'kg',    decimals: 1, higherIsBetter: null,  aggregation: 'last' },
  body_fat:      { key: 'body_fat',      label: '体脂肪率',    unit: '%',     decimals: 1, higherIsBetter: false, aggregation: 'last' },
  lean_mass:     { key: 'lean_mass',     label: '除脂肪体重',  unit: 'kg',    decimals: 1, higherIsBetter: true,  aggregation: 'last' },
  sleep_total:   { key: 'sleep_total',   label: '睡眠時間',    unit: '分',    decimals: 0, higherIsBetter: true,  aggregation: 'sum', asDuration: true },
  sleep_deep:    { key: 'sleep_deep',    label: '深い睡眠',    unit: '分',    decimals: 0, higherIsBetter: true,  aggregation: 'sum', asDuration: true },
  sleep_rem:     { key: 'sleep_rem',     label: 'レム睡眠',    unit: '分',    decimals: 0, higherIsBetter: true,  aggregation: 'sum', asDuration: true },
  sleep_core:    { key: 'sleep_core',    label: '浅い睡眠',    unit: '分',    decimals: 0, higherIsBetter: null,  aggregation: 'sum', asDuration: true },
  hrv:           { key: 'hrv',           label: '睡眠時HRV',   unit: 'ms',    decimals: 0, higherIsBetter: true,  aggregation: 'avg' },
  rhr:           { key: 'rhr',           label: '安静時心拍',  unit: 'bpm',   decimals: 0, higherIsBetter: false, aggregation: 'avg' },
  resp_rate:     { key: 'resp_rate',     label: '呼吸数',      unit: '回/分', decimals: 1, higherIsBetter: null,  aggregation: 'avg' },
  wrist_temp:    { key: 'wrist_temp',    label: '体表温',      unit: '°C',    decimals: 2, higherIsBetter: null,  aggregation: 'avg' },
  steps:         { key: 'steps',         label: '歩数',        unit: '歩',    decimals: 0, higherIsBetter: true,  aggregation: 'sum' },
  active_energy: { key: 'active_energy', label: 'アクティブカロリー', unit: 'kcal', decimals: 0, higherIsBetter: true, aggregation: 'sum' },
};

/** トレンド画面での表示順 */
export const METRIC_ORDER: MetricKey[] = [
  'body_fat', 'weight', 'lean_mass',
  'sleep_total', 'sleep_deep', 'sleep_rem', 'sleep_core',
  'hrv', 'rhr', 'wrist_temp', 'resp_rate',
  'steps', 'active_energy',
];

/** 値のフォーマット(睡眠は 7h32m 形式) */
export function formatValue(key: MetricKey, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '–';
  const def = METRICS[key];
  if (def.asDuration) {
    const m = Math.round(value);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h${String(m % 60).padStart(2, '0')}m` : `${m}m`;
  }
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: def.decimals,
    maximumFractionDigits: def.decimals,
  });
}

/** プリセットのタグ */
export const PRESET_TAGS: { name: string; emoji: string }[] = [
  { name: '飲酒', emoji: '🍺' },
  { name: 'チートデイ', emoji: '🍔' },
  { name: 'フライト', emoji: '✈️' },
  { name: '高負荷トレーニング', emoji: '🏋️' },
  { name: '体調不良', emoji: '🤒' },
];
