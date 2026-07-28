/**
 * v2→v3(スキーマv6)データ移行の純関数部。
 * 旧テーブルの行とマスターコンテンツを ContentItem の挿入仕様へ写像する。
 * 文章は一切要約・改変しない(原文保持)。DB実行は schema.ts 側。
 */
import { CREED, LIFE_GOALS, ROADMAP } from '../data/master';
import type {
  GoalHorizon,
  LegacyAffirmation,
  LegacyKpi,
  LegacyPrinciple,
  LegacyQuest,
  LegacyScene,
  RitualMode,
} from './types';
import { normalizeText } from '../lib/duplicates';

export interface NewItemSpec {
  type: string;
  title: string;
  body: string;
  priority: number;
  is_active: number;
  cadence: string;
  modes: string; // CSV
  emphasis: number;
  sort_order: number;
  extra: Record<string, unknown>;
}

const modes = (...m: RitualMode[]) => m.join(',');

/** BE(宣言文)→ AFFIRMATION。先頭の1篇をQUICK対象の最重要にする */
export function affirmationsToItems(rows: LegacyAffirmation[]): NewItemSpec[] {
  return rows.map((a, i) => ({
    type: 'AFFIRMATION',
    title: a.title,
    body: a.body,
    priority: i === 0 ? 3 : 2,
    is_active: 1,
    cadence: 'daily',
    modes: i === 0 ? modes('quick', 'standard', 'full') : modes('standard', 'full'),
    emphasis: 0,
    sort_order: a.sort_order,
    extra: a.scene_tag ? { sceneTag: a.scene_tag } : {},
  }));
}

/** THEATER(上映シーン)→ IMAGING。最終シーン(IPO)をQUICK対象の最重要にする */
export function scenesToItems(rows: LegacyScene[]): NewItemSpec[] {
  const last = rows.length - 1;
  return rows.map((s, i) => {
    const g = s.bg_gradient.split(',');
    const yearMatch = /(20\d{2})/.exec(s.tag);
    return {
      type: 'IMAGING',
      title: `${s.tag} — ${s.caption}`,
      body: s.body,
      priority: i === last ? 3 : 2,
      is_active: 1,
      cadence: 'daily',
      modes: i === last ? modes('quick', 'standard', 'full') : modes('standard', 'full'),
      emphasis: 0,
      sort_order: s.sort_order,
      extra: {
        tag: s.tag,
        numberText: s.number_text,
        caption: s.caption,
        gradient: [g[0] ?? '#050B12', g[1] ?? '#1B2430', g[2] ?? '#1F4E6B'],
        ...(yearMatch ? { targetYear: Number(yearMatch[1]) } : {}),
        sensoryGuide: ['何が見える?', '誰がいる?', 'どんな気持ちか?', '何を話している?'],
      },
    };
  });
}

/** COCKPITのKPI → NUMBER。commit=正式目標 / stretch=イメージング目標を分離のまま移す */
export function kpisToItems(rows: LegacyKpi[]): NewItemSpec[] {
  return rows.map((k, i) => ({
    type: 'NUMBER',
    title: k.label,
    body: '',
    priority: i === 0 ? 3 : 2,
    is_active: 1,
    cadence: 'daily',
    modes: i === 0 ? modes('quick', 'standard', 'full') : modes('standard', 'full'),
    emphasis: 0,
    sort_order: k.sort_order,
    extra: {
      unit: k.unit,
      officialTarget: k.commit_value,
      currentValue: k.current_value,
      imagingTarget: k.stretch_value,
      deadline: k.deadline,
      targetYear: Number(k.deadline.slice(0, 4)),
      linkedCondition: k.linked_condition,
    },
  }));
}

export function horizonForYear(year: number): GoalHorizon {
  if (year <= 2026) return 'SHORT';
  if (year <= 2030) return 'MID';
  return 'LONG';
}

/**
 * VISIONのロードマップ+人生の到達点 → GOAL。
 * 2026(SHORT)・2028(MID)・2034(LONG)を毎日枠の代表に立てる。
 */
export function roadmapToItems(): NewItemSpec[] {
  const primaryYears = new Set([2026, 2028, 2034]);
  const items: NewItemSpec[] = ROADMAP.map((r, i) => {
    const primary = primaryYears.has(r.year);
    return {
      type: 'GOAL',
      title: `${r.year} 売上${r.rev} / EBITDA${r.ebitda}`,
      body: r.note || `${r.year}年(${r.age}歳)。売上${r.rev}・EBITDA${r.ebitda}。`,
      priority: primary ? 3 : 2,
      is_active: 1,
      cadence: 'daily',
      modes: primary ? modes('quick', 'standard', 'full') : modes('full'),
      emphasis: 0,
      sort_order: i,
      extra: { horizon: horizonForYear(r.year), targetYear: r.year },
    };
  });
  // 2034はIPOの表現を正とする
  const ipo = items.find((x) => (x.extra.targetYear as number) === 2034);
  if (ipo) {
    ipo.title = '2034 時価総額6,500億円でIPO';
    ipo.body = '離島から1兆円企業へ。売上550億・EBITDA270億。';
  }
  LIFE_GOALS.forEach((g, i) => {
    items.push({
      type: 'GOAL',
      title: '人生の到達点',
      body: g,
      priority: 2,
      is_active: 1,
      cadence: 'daily',
      modes: modes('full'),
      emphasis: 0,
      sort_order: 100 + i,
      extra: { horizon: 'LONG' },
    });
  });
  return items;
}

/**
 * MINDの心得 → PRINCIPLE(ROTATING)。戒め3カ条はCOREとして新設する。
 * 旧テーブルのオンオフ(active)を維持する。
 */
export function principlesToItems(rows: LegacyPrinciple[]): NewItemSpec[] {
  const core: NewItemSpec[] = CREED.map((text, i) => ({
    type: 'PRINCIPLE',
    title: '',
    body: text,
    priority: 3,
    is_active: 1,
    cadence: 'daily',
    modes: modes('quick', 'standard', 'full'),
    emphasis: 0,
    sort_order: i,
    extra: { role: 'CORE', category: '2026年 戒め' },
  }));
  const rotating: NewItemSpec[] = rows.map((p, i) => ({
    type: 'PRINCIPLE',
    title: '',
    body: p.text,
    priority: 2,
    is_active: p.active,
    cadence: 'rotation',
    modes: modes('standard', 'full'),
    emphasis: 0,
    sort_order: 10 + (p.sort_order ?? i),
    extra: { role: 'ROTATING', category: p.category },
  }));
  return [...core, ...rotating];
}

/** 年間クエスト → OPTIONAL(儀式には出さない。MASTERで管理・チェック継続) */
export function questsToItems(rows: LegacyQuest[]): NewItemSpec[] {
  return rows.map((qq, i) => ({
    type: 'OPTIONAL',
    title: qq.title,
    body: qq.note ?? '',
    priority: 2,
    is_active: 1,
    cadence: 'daily',
    modes: '',
    emphasis: 0,
    sort_order: i,
    extra: { group: 'QUEST', category: qq.category, done: qq.done === 1 },
  }));
}

/** BODY習慣・睡眠ルール → OPTIONAL(削除せず補助カテゴリとして保持) */
export function bodyToItems(
  habits: readonly { label: string; note: string }[],
  sleepRules: readonly string[]
): NewItemSpec[] {
  const items: NewItemSpec[] = habits.map((h, i) => ({
    type: 'OPTIONAL',
    title: h.label,
    body: h.note,
    priority: 2,
    is_active: 1,
    cadence: 'daily',
    modes: '',
    emphasis: 0,
    sort_order: 200 + i,
    extra: { group: 'BODY' },
  }));
  sleepRules.forEach((r, i) => {
    items.push({
      type: 'OPTIONAL',
      title: '',
      body: r,
      priority: 1,
      is_active: 1,
      cadence: 'daily',
      modes: '',
      emphasis: 0,
      sort_order: 300 + i,
      extra: { group: 'SLEEP' },
    });
  });
  return items;
}

/**
 * 完全一致(正規化後)の重複を候補としてマークする。自動削除・統合はしない。
 * 返り値: index→canonical index のマップ(最初に出た方を正とする)。
 */
export function markExactDuplicates(items: NewItemSpec[]): Map<number, number> {
  const seen = new Map<string, number>();
  const dup = new Map<number, number>();
  items.forEach((it, i) => {
    const key = `${it.type}:${normalizeText(it.title + it.body)}`;
    if (it.body === '' && it.title === '') return;
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, i);
    } else {
      dup.set(i, first);
    }
  });
  return dup;
}
