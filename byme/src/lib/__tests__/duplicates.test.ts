import { describe, expect, it } from 'vitest';
import { DUPLICATE_THRESHOLD, LocalDuplicateDetector, normalizeText, similarity } from '../duplicates';

describe('normalizeText', () => {
  it('句読点・空白・記号を除去して比較用に正規化する', () => {
    expect(normalizeText('恥や プライドが、最も良くない。')).toBe(normalizeText('恥やプライドが最も良くない'));
  });
});

describe('similarity', () => {
  it('完全一致(正規化後)は1', () => {
    const r = similarity('完璧を目指さない。', '完璧を目指さない');
    expect(r.score).toBe(1);
    expect(r.kind).toBe('exact');
  });

  it('仕様の例: 意味の近い文章が閾値以上で検出される', () => {
    const r = similarity(
      '恥やプライドを捨てることが成功には重要',
      '恥やプライドが最も良くない。これが無ければ全てを実現できる。'
    );
    expect(r.score).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it('無関係な文章は低スコア', () => {
    const r = similarity('毎朝Visionを確認する。', '英語力B2');
    expect(r.score).toBeLessThan(DUPLICATE_THRESHOLD);
  });

  it('包含関係を検出する', () => {
    const r = similarity('退屈を楽しみ、圧倒的な反復をせよ。', '退屈を楽しみ、圧倒的な反復をせよ。それが全てだ。');
    expect(r.score).toBeGreaterThanOrEqual(0.85);
  });
});

describe('LocalDuplicateDetector', () => {
  it('候補をスコア降順で返し、閾値未満は返さない', async () => {
    const detector = new LocalDuplicateDetector(0.4);
    const candidates = [
      { title: '', body: '恥やプライドが最も良くない。これが無ければ全てを実現できる。' },
      { title: '', body: '家族を大切にする。稼いだ金を有効に使う。' },
    ];
    const found = await detector.find('恥やプライドが最も良くない。これがなければ全てを実現できる。', candidates);
    expect(found.length).toBe(1);
    expect(found[0].item.body).toContain('恥やプライド');
  });
});
