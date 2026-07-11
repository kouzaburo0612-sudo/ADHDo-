/**
 * VYTA デザイントークン
 *
 * ロゴ(ネイビーのワードマーク+ティールのダッシュ)に寄せた
 * 「深いネイビーの夜にティールが灯る」ダークテーマ。
 * 黒背景+蛍光色のテンプレ配色は使わない。
 */
import { Platform } from 'react-native';

export const Colors = {
  /** 画面のベース背景。ロゴのネイビーを暗くした夜色 */
  bg: '#0B1220',
  /** カード背景 */
  surface: '#141E2D',
  /** 一段浮いたカード・押下時 */
  surfaceRaised: '#1C293B',
  /** 罫線・区切り */
  border: '#27364B',

  /** 主要テキスト。純白ではなく柔らかいオフホワイト */
  text: '#F2F5F8',
  /** 補助テキスト */
  textSecondary: '#95A5B9',
  /** さらに弱いテキスト(単位・注釈) */
  textFaint: '#5C6C81',

  /** アクセント。ロゴのティール — 主要数値と達成表現に使う */
  accent: '#40D9C4',
  accentDim: '#14504A',

  /** カテゴリ色 */
  sleep: '#7FA8E8',    // 穏やかな夜の青
  recovery: '#4CC9B0', // ティール
  body: '#40D9C4',     // ロゴティール(体組成=主役)
  activity: '#F5B94E', // 陽のアンバー

  /** 状態色 */
  good: '#40D9C4',
  warn: '#F5B94E',
  bad: '#F4726D',

  /** カロリー収支(赤字=痩せる方向=良い) */
  deficit: '#40D9C4',
  surplus: '#F4726D',

  /** グラフ補助 */
  chartGrid: '#1D2A3D',
  chartCompare1: '#7FA8E8', // 1ヶ月前
  chartCompare2: '#5B7085', // 1年前
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
 * タイポグラフィ。ロゴの幾何学的サンセリフに合わせ、
 * ワードマークと数値はMontserrat(ロゴと同系の骨格)、日本語本文はシステムフォント。
 * Montserratは_layoutでexpo-fontによりロード済みであることが前提。
 */
export const Fonts = {
  /** 本文(日本語はシステムフォントが最も読みやすい) */
  sans: Platform.select({ ios: 'system-ui', default: 'normal' }) as string,
  /** 大きな数値表示用(ロゴと同系の幾何学サンセリフ) */
  display: 'Montserrat_700Bold',
  /** ブランドワードマーク */
  brand: 'Montserrat_600SemiBold',
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
