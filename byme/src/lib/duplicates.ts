/**
 * 重複検出サービス。
 * ローカル実装は 正規化→完全一致/包含/文字bigramのJaccard係数 による簡易類似スコア。
 * 「AIが動いているように見せる」偽実装はしない。将来LLM APIに差し替えられるよう
 * DuplicateDetector インターフェースで分離している(アプリ本体はPhase 1ネットワーク不使用)。
 */

export interface DuplicateMatch<T> {
  item: T;
  /** 0〜1。1=完全一致 */
  score: number;
  kind: 'exact' | 'contains' | 'similar';
}

export interface DuplicateDetector {
  /** text と候補群を比較し、閾値以上をスコア降順で返す */
  find<T extends { title: string; body: string }>(
    text: string,
    candidates: T[]
  ): Promise<DuplicateMatch<T>[]>;
}

/** 比較用の正規化: NFKC→小文字→空白・句読点・記号の除去 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s。、．，.,!?!?・:;:;「」『』()()\[\]【】\-—–…‥"'"']/g, '');
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  if (s.length === 1) {
    set.add(s);
    return set;
  }
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

function intersection(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = intersection(a, b);
  return inter / (a.size + b.size - inter);
}

/** overlap係数: 短い方に対する共通部分の割合。長さ差の大きい類似文を拾う */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  return intersection(a, b) / Math.min(a.size, b.size);
}

/** 2つの文章の類似スコア(0〜1) */
export function similarity(a: string, b: string): { score: number; kind: DuplicateMatch<never>['kind'] } {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na.length === 0 || nb.length === 0) return { score: 0, kind: 'similar' };
  if (na === nb) return { score: 1, kind: 'exact' };
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (long.includes(short) && short.length >= 6) {
    return { score: 0.85, kind: 'contains' };
  }
  const ba = bigrams(na);
  const bb = bigrams(nb);
  // Jaccardは長さ差の大きい類似文を見逃すため、overlap係数(0.9掛け)と併用する
  const score = Math.max(jaccard(ba, bb), overlap(ba, bb) * 0.9);
  return { score, kind: 'similar' };
}

/** 「似た内容がすでにあります」を出す閾値 */
export const DUPLICATE_THRESHOLD = 0.25;

export class LocalDuplicateDetector implements DuplicateDetector {
  constructor(private threshold: number = DUPLICATE_THRESHOLD) {}

  async find<T extends { title: string; body: string }>(
    text: string,
    candidates: T[]
  ): Promise<DuplicateMatch<T>[]> {
    const results: DuplicateMatch<T>[] = [];
    for (const c of candidates) {
      const target = `${c.title}${c.body}`;
      const { score, kind } = similarity(text, target);
      if (score >= this.threshold) results.push({ item: c, score, kind });
    }
    return results.sort((x, y) => y.score - x.score);
  }
}

export const duplicateDetector: DuplicateDetector = new LocalDuplicateDetector();
