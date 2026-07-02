// ダークUIの基本トークン(ダーク背景でCVD分離・コントラスト検証済みのカテゴリ色)
export const T = {
  bg: '#0d1017',
  surface: '#131722',
  surface2: '#1a2030',
  line: '#232b3d',
  ink: '#e8ecf4',
  ink2: '#98a2b8',
  ink3: '#5f6a82',
};

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
