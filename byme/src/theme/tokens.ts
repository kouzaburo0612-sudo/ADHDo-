/**
 * BYME デザイントークン
 * ロゴ(ネイビーのワードマーク + スティールブルーの▼)に合わせた
 * 白基調のモダンミニマリズム。プロトタイプ byme.jsx を正とする。
 */
export const colors = {
  paper: '#F6F8FA',
  white: '#FFFFFF',
  ink: '#1B2430',
  inkSoft: '#3A4656',
  blue: '#2E7196',
  blueDeep: '#1F4E6B',
  bluePale: '#E7F0F5',
  mist: '#8A94A3',
  line: '#E2E7ED',
} as const;

/** フォントファミリー(app/_layout.tsx でロード) */
export const fonts = {
  /** 英字見出し・ラベル(letter-spacing広め・大文字で使う) */
  en: 'Jost_500Medium',
  enSemi: 'Jost_600SemiBold',
  enBold: 'Jost_700Bold',
  jp: 'ZenKakuGothicNew_400Regular',
  jpMedium: 'ZenKakuGothicNew_500Medium',
  jpBold: 'ZenKakuGothicNew_700Bold',
  /** 宣言文は weight 900 */
  jpBlack: 'ZenKakuGothicNew_900Black',
} as const;

export const radii = {
  card: 16,
  chip: 999,
  input: 12,
} as const;

export const spacing = {
  screenX: 20,
  cardPad: 18,
  gap: 12,
} as const;

/** 英字ラベル共通スタイル */
export const enLabel = {
  fontFamily: fonts.enSemi,
  letterSpacing: 2.4,
  textTransform: 'uppercase' as const,
};
