import { describe, expect, it } from 'vitest';
import type { ContentItem } from '../../db/types';
import { buildPlaylist, cadenceDue, expandSteps, playlistCounts, rotationScore } from '../playlist';

let seq = 0;
function item(partial: Partial<ContentItem> & { type: ContentItem['type'] }): ContentItem {
  seq += 1;
  return {
    id: seq,
    title: `t${seq}`,
    body: `body ${seq}`,
    priority: 2,
    is_active: 1,
    cadence: 'daily',
    modes: 'quick,standard,full',
    emphasis: 0,
    sort_order: seq,
    extra: '{}',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    last_shown_at: null,
    show_count: 0,
    archived_at: null,
    canonical_item_id: null,
    duplicate_status: null,
    ...partial,
  };
}

function fixture(): ContentItem[] {
  const items: ContentItem[] = [];
  for (let i = 0; i < 5; i++) {
    items.push(item({ type: 'AFFIRMATION', priority: i === 0 ? 3 : 2 }));
  }
  for (let i = 0; i < 7; i++) {
    items.push(item({ type: 'IMAGING', priority: i === 6 ? 3 : 2, modes: 'standard,full' }));
  }
  items.push(item({ type: 'IMAGING', priority: 3 })); // quick対象
  for (const [horizon, year] of [
    ['SHORT', 2026],
    ['MID', 2028],
    ['LONG', 2034],
  ] as const) {
    items.push(
      item({ type: 'GOAL', priority: 3, extra: JSON.stringify({ horizon, targetYear: year }) })
    );
  }
  items.push(item({ type: 'GOAL', priority: 2, modes: 'full', extra: JSON.stringify({ horizon: 'MID' }) }));
  for (let i = 0; i < 5; i++) {
    items.push(
      item({
        type: 'NUMBER',
        priority: i === 0 ? 3 : 2,
        extra: JSON.stringify({ unit: '億円', officialTarget: 10, currentValue: 1, imagingTarget: i < 2 ? 30 : null }),
      })
    );
  }
  for (let i = 0; i < 3; i++) {
    items.push(item({ type: 'PRINCIPLE', priority: 3, extra: JSON.stringify({ role: 'CORE' }) }));
  }
  for (let i = 0; i < 20; i++) {
    items.push(
      item({ type: 'PRINCIPLE', cadence: 'rotation', modes: 'standard,full', extra: JSON.stringify({ role: 'ROTATING' }) })
    );
  }
  return items;
}

describe('buildPlaylist', () => {
  const date = new Date(2026, 6, 28);

  it('QUICK/STANDARD/FULLで内容(件数)が変わる', () => {
    const items = fixture();
    const quick = buildPlaylist(items, 'quick', date);
    const standard = buildPlaylist(items, 'standard', date);
    const full = buildPlaylist(items, 'full', date);
    expect(quick.length).toBeLessThan(standard.length);
    expect(standard.length).toBeLessThan(full.length);
  });

  it('QUICKは最重要アファ1・イメージング1・3階層の目標・最重要数字・最重要原則1を含む', () => {
    const items = fixture();
    const ids = buildPlaylist(items, 'quick', date);
    const counts = playlistCounts(items, ids);
    expect(counts.AFFIRMATION).toBe(1);
    expect(counts.IMAGING).toBe(1);
    expect(counts.GOAL).toBe(3);
    expect(counts.NUMBER).toBe(1);
    expect(counts.PRINCIPLE).toBe(1);
    // 最重要(priority 3)が選ばれている
    const map = new Map(items.map((i) => [i.id, i]));
    const aff = ids.map((id) => map.get(id)!).find((i) => i.type === 'AFFIRMATION')!;
    expect(aff.priority).toBe(3);
  });

  it('順番は必ず AFFIRMATION→IMAGING→GOAL→NUMBER→PRINCIPLE', () => {
    const items = fixture();
    const map = new Map(items.map((i) => [i.id, i]));
    for (const mode of ['quick', 'standard', 'full'] as const) {
      const types = buildPlaylist(items, mode, date).map((id) => map.get(id)!.type);
      const order = ['AFFIRMATION', 'IMAGING', 'GOAL', 'NUMBER', 'PRINCIPLE'];
      const positions = types.map((t) => order.indexOf(t));
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it('CORE PRINCIPLESは毎回含まれる', () => {
    const items = fixture();
    const map = new Map(items.map((i) => [i.id, i]));
    for (const mode of ['standard', 'full'] as const) {
      const core = buildPlaylist(items, mode, date)
        .map((id) => map.get(id)!)
        .filter((i) => i.type === 'PRINCIPLE' && JSON.parse(i.extra).role === 'CORE');
      expect(core.length).toBe(3);
    }
  });

  it('ROTATINGは偏りなく一巡する(30日シミュレーション)', () => {
    const items = fixture();
    const rotatingIds = new Set(
      items.filter((i) => i.type === 'PRINCIPLE' && i.cadence === 'rotation').map((i) => i.id)
    );
    const shown = new Set<number>();
    for (let day = 0; day < 30; day++) {
      const d = new Date(2026, 0, 1 + day);
      const ids = buildPlaylist(items, 'standard', d);
      for (const id of ids) {
        if (rotatingIds.has(id)) {
          shown.add(id);
          // 表示済みとして更新(実アプリでは完了時にlast_shown_at更新)
          const it = items.find((x) => x.id === id)!;
          it.last_shown_at = d.toISOString();
          it.show_count += 1;
        }
      }
    }
    expect(shown.size).toBe(rotatingIds.size);
  });

  it('空データでもクラッシュしない', () => {
    expect(buildPlaylist([], 'standard', date)).toEqual([]);
    expect(expandSteps([], []).at(-1)).toEqual({ kind: 'complete' });
  });

  it('アーカイブ済み・merged・無効はプレイリストに入らない', () => {
    const items = [
      item({ type: 'AFFIRMATION', archived_at: '2026-01-01T00:00:00.000Z' }),
      item({ type: 'AFFIRMATION', duplicate_status: 'merged' }),
      item({ type: 'AFFIRMATION', is_active: 0 }),
      item({ type: 'AFFIRMATION' }),
    ];
    const ids = buildPlaylist(items, 'full', date);
    expect(ids).toEqual([items[3].id]);
  });
});

describe('expandSteps', () => {
  it('NUMBERは公式目標→イメージング目標の2画面に分かれ、混ざらない', () => {
    const items = fixture();
    const ids = buildPlaylist(items, 'standard', new Date(2026, 6, 28));
    const steps = expandSteps(items, ids);
    const kinds = steps.map((s) => s.kind);
    expect(kinds).toContain('numbers-official');
    expect(kinds).toContain('numbers-imaging');
    const official = steps.find((s) => s.kind === 'numbers-official');
    const imaging = steps.find((s) => s.kind === 'numbers-imaging');
    if (official?.kind === 'numbers-official' && imaging?.kind === 'numbers-imaging') {
      // imaging画面はimagingTargetを持つ項目のみ
      expect(imaging.items.length).toBeLessThan(official.items.length);
      for (const n of imaging.items) {
        expect(JSON.parse(n.extra).imagingTarget).not.toBeNull();
      }
    }
    expect(kinds.at(-1)).toBe('complete');
  });
});

describe('cadenceDue', () => {
  it('weekly指定の曜日だけ該当する', () => {
    const tue = new Date(2026, 6, 28); // 火曜
    expect(cadenceDue('weekly:2', tue)).toBe(true);
    expect(cadenceDue('weekly:0,6', tue)).toBe(false);
    expect(cadenceDue('daily', tue)).toBe(true);
  });
});

describe('rotationScore', () => {
  it('未表示・重点反復・経過日数で優先度が上がる', () => {
    const now = new Date(2026, 6, 28);
    const fresh = item({ type: 'PRINCIPLE', last_shown_at: now.toISOString(), show_count: 10 });
    const stale = item({ type: 'PRINCIPLE', last_shown_at: '2026-06-01T00:00:00.000Z', show_count: 10 });
    const never = item({ type: 'PRINCIPLE', last_shown_at: null, show_count: 0 });
    const emphasized = item({ type: 'PRINCIPLE', last_shown_at: now.toISOString(), show_count: 10, emphasis: 1 });
    expect(rotationScore(stale, now)).toBeGreaterThan(rotationScore(fresh, now));
    expect(rotationScore(never, now)).toBeGreaterThan(rotationScore(fresh, now));
    expect(rotationScore(emphasized, now)).toBeGreaterThan(rotationScore(fresh, now));
  });
});
