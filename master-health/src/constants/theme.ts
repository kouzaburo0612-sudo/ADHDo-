/**
 * Master Health デザイントークン
 *
 * ダークテーマ専用。「深い森の夜にエメラルドの生命力が灯る」コンセプト。
 * 健康・回復・成長を想起させる緑基調で、達成(赤字の積み上げ)をエメラルドで祝う。
 * 黒背景+蛍光色のテンプレ配色は使わない。
 */
import { Platform } from 'react-native';

export const Colors = {
  /** 画面のベース背景。純黒ではなく、わずかに緑みのある炭色 */
  bg: '#0C1310',
  /** カード背景 */
  surface: '#15201B',
  /** 一段浮いたカード・押下時 */
  surfaceRaised: '#1D2B24',
  /** 罫線・区切り */
  border: '#28382F',

  /** 主要テキスト。純白ではなく柔らかいオフホワイト */
  text: '#F0F5F1',
  /** 補助テキスト */
  textSecondary: '#96A99D',
  /** さらに弱いテキスト(単位・注釈) */
  textFaint: '#5D6F64',

  /** アクセント。エメラルドグリーン — 主要数値と達成表現に使う */
  accent: '#3DDC97',
  accentDim: '#1D5C42',

  /** カテゴリ色 */
  sleep: '#7FA8E8',    // 穏やかな夜の青
  recovery: '#4CC9B0', // ティール
  body: '#3DDC97',     // エメラルド(体組成=主役)
  activity: '#F5B94E', // 陽のアンバー

  /** 状態色 */
  good: '#3DDC97',
  warn: '#F5B94E',
  bad: '#F4726D',

  /** カロリー収支(赤字=痩せる方向=良い) */
  deficit: '#3DDC97',
  surplus: '#F4726D',

  /** グラフ補助 */
  chartGrid: '#1F2E26',
  chartCompare1: '#7FA8E8', // 1ヶ月前
  chartCompare2: '#5B7A6B', // 1年前
} as const;

/** スコア値(0-100)に応じた色 */
export function scoreColor(score: number | null): string {
  if (score == null) return Colors.textFaint;
  if (score >= 80) return Colors.good;
  if (score >= 60) return Colors.accent;
  if (score >= 40) return Colors.warn;
  return Colors.bad;
}

/**
 * タイポグラフィ。数値が主役:
 * 大きな数字は丸みのあるSF Rounded、表・グラフは等幅数字(tabular-nums)で桁を揃える。
 */
export const Fonts = {
  /** 本文 */
  sans: Platform.select({ ios: 'system-ui', default: 'normal' }) as string,
  /** 大きな数値表示用 */
  display: Platform.select({ ios: 'ui-rounded', default: 'normal' }) as string,
  /** 等幅 */
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }) as string,
} as const;

/** タイプスケール(数値階層を徹底: 大きな数字 + 小さなラベル) */
export const Type = {
  hero: 76,       // 総合スコア
  display: 40,    // 画面主要数値
  metric: 26,     // カード内数値
  title: 20,      // セクション見出し
  body: 15,       // 本文
  label: 12,      // ラベル
  caption: 11,    // 注釈・単位
} as const;

/** スペーシング(4pxグリッド) */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
} as const;

/** 数字表示に常用するスタイル断片 */
export const numeric = {
  fontFamily: Fonts.display,
  fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  color: Colors.text,
} as const;
