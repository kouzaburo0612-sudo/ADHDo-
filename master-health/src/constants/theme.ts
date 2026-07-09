/**
 * Master Health デザイントークン
 *
 * ダークテーマ専用。「深いインクブルーの夜空に、シャンパンゴールドの数値が浮かぶ」
 * ことをコンセプトにした、このアプリ固有のパレット。
 * 黒背景+蛍光色のテンプレ配色は使わない。
 */
import { Platform } from 'react-native';

export const Colors = {
  /** 画面のベース背景。純黒ではなく、わずかに青みのある炭色 */
  bg: '#0F1319',
  /** カード背景 */
  surface: '#171D26',
  /** 一段浮いたカード・押下時 */
  surfaceRaised: '#1F2733',
  /** 罫線・区切り */
  border: '#2A3341',

  /** 主要テキスト。純白ではなく温かみのあるアイボリー */
  text: '#F1EDE4',
  /** 補助テキスト */
  textSecondary: '#98A2B0',
  /** さらに弱いテキスト(単位・注釈) */
  textFaint: '#5F6979',

  /** アクセント。シャンパンゴールド — 総合スコアと主要数値に使う */
  accent: '#D9B36C',
  accentDim: '#8A744C',

  /** カテゴリ色(彩度を抑えた4色) */
  sleep: '#8FA9CC',    // 静かな青
  recovery: '#85BFA4', // セージグリーン
  body: '#D9B36C',     // ゴールド(体組成=主役)
  activity: '#C98D62', // テラコッタ

  /** 状態色 */
  good: '#85BFA4',
  warn: '#D9A05C',
  bad: '#C97062',

  /** グラフ補助 */
  chartGrid: '#232C39',
  chartCompare1: '#8FA9CC', // 1ヶ月前
  chartCompare2: '#6B7A94', // 1年前
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
