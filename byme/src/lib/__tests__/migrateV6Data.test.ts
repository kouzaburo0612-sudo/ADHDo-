import { describe, expect, it } from 'vitest';
import {
  affirmationsToItems,
  horizonForYear,
  kpisToItems,
  markExactDuplicates,
  principlesToItems,
  questsToItems,
  roadmapToItems,
  scenesToItems,
} from '../../db/migrateV6Data';
import { CREED } from '../../data/master';

describe('v6移行の写像', () => {
  it('アファメーションは原文を改変せず移す', () => {
    const rows = [
      { id: 1, title: '① 自信・与える', body: '自分は特別な人間である。', scene_tag: null, sort_order: 0 },
    ];
    const items = affirmationsToItems(rows);
    expect(items[0].body).toBe('自分は特別な人間である。');
    expect(items[0].title).toBe('① 自信・与える');
    expect(items[0].type).toBe('AFFIRMATION');
    expect(items[0].modes).toContain('quick'); // 先頭は最重要
  });

  it('KPIは正式目標(commit)とイメージング目標(stretch)を別フィールドで保持する', () => {
    const rows = [
      {
        id: 1,
        label: 'グループ売上',
        commit_value: 17.2,
        stretch_value: 30,
        current_value: 2,
        unit: '億円',
        deadline: '2026-12-31',
        linked_condition: null,
        sort_order: 0,
      },
    ];
    const [n] = kpisToItems(rows);
    expect(n.extra.officialTarget).toBe(17.2);
    expect(n.extra.imagingTarget).toBe(30);
    expect(n.extra.currentValue).toBe(2);
    expect(n.extra.officialTarget).not.toBe(n.extra.imagingTarget);
  });

  it('戒め3カ条がCORE、旧心得はROTATINGとしてactive維持で移る', () => {
    const rows = [
      { id: 1, category: '成功法則', text: '完璧を目指さない。', active: 0, sort_order: 5 },
    ];
    const items = principlesToItems(rows);
    const core = items.filter((i) => i.extra.role === 'CORE');
    expect(core.length).toBe(CREED.length);
    expect(core.map((c) => c.body)).toEqual([...CREED]);
    const rotating = items.find((i) => i.body === '完璧を目指さない。')!;
    expect(rotating.extra.role).toBe('ROTATING');
    expect(rotating.is_active).toBe(0);
  });

  it('ロードマップはSHORT/MID/LONGへ写像され、2026/2028/2034が毎日枠になる', () => {
    expect(horizonForYear(2026)).toBe('SHORT');
    expect(horizonForYear(2028)).toBe('MID');
    expect(horizonForYear(2034)).toBe('LONG');
    const goals = roadmapToItems();
    const daily = goals.filter((g) => g.modes.includes('standard'));
    expect(daily.map((g) => g.extra.targetYear)).toEqual([2026, 2028, 2034]);
  });

  it('シーンはIMAGINGへ。グラデーションとシーン文が保持される', () => {
    const rows = [
      {
        id: 1,
        tag: '2034 IPO',
        number_text: '6,500億',
        caption: '時価総額',
        body: '2034年。東証の鐘を鳴らしている。',
        bg_gradient: '#1A0F0A,#4A2A14,#C9A961',
        sort_order: 6,
      },
    ];
    const [img] = scenesToItems(rows);
    expect(img.body).toBe('2034年。東証の鐘を鳴らしている。');
    expect((img.extra.gradient as string[])[2]).toBe('#C9A961');
    expect(img.extra.targetYear).toBe(2034);
  });

  it('クエストはOPTIONALでチェック状態を保持し、儀式には出さない', () => {
    const rows = [{ id: 1, category: '仕事', title: '役員旅行', done: 1, note: null }];
    const [opt] = questsToItems(rows);
    expect(opt.type).toBe('OPTIONAL');
    expect(opt.extra.done).toBe(true);
    expect(opt.modes).toBe('');
  });

  it('完全一致の重複は候補としてマークされる(2件目以降)', () => {
    const items = affirmationsToItems([
      { id: 1, title: '', body: '完璧を目指さない。', scene_tag: null, sort_order: 0 },
      { id: 2, title: '', body: '完璧を目指さない', scene_tag: null, sort_order: 1 },
      { id: 3, title: '', body: '別の文章。', scene_tag: null, sort_order: 2 },
    ]);
    const dup = markExactDuplicates(items);
    expect(dup.size).toBe(1);
    expect(dup.get(1)).toBe(0);
  });
});
