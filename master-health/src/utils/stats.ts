/** 汎用統計ユーティリティ */

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * 最小二乗法の単回帰。xは等間隔(日数)を想定。
 * 返り値 slope は「1日あたりの変化量」。
 */
export function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 5) return null; // 点が少なすぎる予測は出さない
  const sx = points.reduce((a, p) => a + p.x, 0);
  const sy = points.reduce((a, p) => a + p.y, 0);
  const sxx = points.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = points.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

/** 過去データに対するzスコア(ベースライン比較の基本形) */
export function zScore(value: number, history: number[]): number | null {
  const m = mean(history);
  const sd = stddev(history);
  if (m == null || sd == null || sd === 0) return null;
  return (value - m) / sd;
}
