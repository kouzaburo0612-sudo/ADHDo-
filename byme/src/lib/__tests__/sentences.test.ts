import { describe, expect, it } from 'vitest';
import { splitSentences } from '../sentences';

describe('splitSentences', () => {
  it('句点・感嘆・疑問で分割する', () => {
    expect(splitSentences('自分は特別な人間である。今まで多くのことを成し遂げてきた。')).toEqual([
      '自分は特別な人間である。',
      '今まで多くのことを成し遂げてきた。',
    ]);
  });

  it('改行でも分割する', () => {
    expect(splitSentences('一行目\n二行目')).toEqual(['一行目', '二行目']);
  });

  it('区切りが無い長文はそのまま1画面', () => {
    expect(splitSentences('区切りのない文章')).toEqual(['区切りのない文章']);
  });

  it('空文字でもクラッシュしない', () => {
    expect(splitSentences('')).toEqual(['']);
  });
});
