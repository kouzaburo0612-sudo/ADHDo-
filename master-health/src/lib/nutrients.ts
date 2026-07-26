/**
 * 栄養素マスタ。
 * direction: 評価の向き。
 * - more_is_better: 多いほど良い(たんぱく質など)。目標達成で称賛、超過しても警告しない
 * - less_is_better: 目標以内に収める(カロリー・脂質・炭水化物)。超過で赤表示
 * 将来の拡張(食物繊維=more_is_better 等)はここに行を足すだけで対応できる。
 */
export type NutrientDirection = 'more_is_better' | 'less_is_better';

export interface NutrientDef {
  key: 'kcal' | 'protein' | 'fat' | 'carbs';
  /** 表示名 */
  label: string;
  /** 短縮記号(P/F/C)。カロリーは空 */
  short: string;
  unit: string;
  direction: NutrientDirection;
}

export const NUTRIENTS: NutrientDef[] = [
  { key: 'kcal', label: 'カロリー', short: '', unit: 'kcal', direction: 'less_is_better' },
  { key: 'protein', label: 'たんぱく質', short: 'P', unit: 'g', direction: 'more_is_better' },
  { key: 'fat', label: '脂質', short: 'F', unit: 'g', direction: 'less_is_better' },
  { key: 'carbs', label: '炭水化物', short: 'C', unit: 'g', direction: 'less_is_better' },
];
