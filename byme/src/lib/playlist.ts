/**
 * 儀式プレイリスト生成(純関数)。
 * 順番は必ず AFFIRMATION → IMAGING → GOALS → NUMBERS → PRINCIPLES に固定。
 * QUICK/STANDARD/FULL で件数だけが変わる。ユーザーに毎回選択させない。
 */
import type { ContentItem, GoalExtra, PrincipleExtra, RitualMode } from '../db/types';
import { parseExtra, parseModes } from '../db/types';

export const TYPE_ORDER = ['AFFIRMATION', 'IMAGING', 'GOAL', 'NUMBER', 'PRINCIPLE'] as const;

/** モードごとの件数上限(FULLは設定 full_max_items でさらに制限可能) */
const CAPS: Record<RitualMode, { aff: number; img: number; num: number; core: number; rotating: number }> = {
  quick: { aff: 1, img: 1, num: 1, core: 1, rotating: 0 },
  standard: { aff: 5, img: 3, num: 99, core: 5, rotating: 1 },
  full: { aff: 99, img: 99, num: 99, core: 5, rotating: 3 },
};

const HORIZON_ORDER = { LONG: 0, MID: 1, SHORT: 2 } as const;

/** 表示頻度が今日該当するか */
export function cadenceDue(cadence: string, date: Date): boolean {
  if (cadence === 'daily' || cadence === 'rotation' || cadence === '') return true;
  const [kind, arg] = cadence.split(':');
  if (kind === 'weekly') {
    const days = (arg ?? '').split(',').map(Number);
    return days.includes(date.getDay());
  }
  if (kind === 'monthly') {
    const dates = (arg ?? '1').split(',').map(Number);
    return dates.includes(date.getDate());
  }
  return true;
}

function usable(item: ContentItem, mode: RitualMode, date: Date): boolean {
  return (
    item.is_active === 1 &&
    item.archived_at === null &&
    item.duplicate_status !== 'merged' &&
    parseModes(item).includes(mode) &&
    cadenceDue(item.cadence, date)
  );
}

function byPriority(a: ContentItem, b: ContentItem): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.id - b.id;
}

function daysSince(iso: string | null, now: Date): number {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 9999;
  return Math.max(0, (now.getTime() - t) / 86400000);
}

/**
 * ROTATING原則の表示優先度。完全ランダムにはしない。
 * 重要度・最終表示からの経過・表示回数の少なさ・追加の新しさ・重点反復で加点。
 * 経過日数の重みにより、全項目が一定期間内に必ず一巡する。
 */
export function rotationScore(item: ContentItem, now: Date): number {
  const since = Math.min(daysSince(item.last_shown_at, now), 60);
  const neverShown = item.show_count === 0 ? 25 : Math.max(0, 12 - item.show_count);
  const isNew = daysSince(item.created_at, now) <= 14 ? 10 : 0;
  return item.priority * 20 + item.emphasis * 40 + since * 3 + neverShown + isNew;
}

export interface PlaylistOptions {
  fullMaxItems?: number;
}

/**
 * その日のプレイリスト(content_item idの配列)を生成する。
 * 生成結果はセッションに固定保存されるため、同日再生でも内容は変わらない。
 */
export function buildPlaylist(
  items: ContentItem[],
  mode: RitualMode,
  date: Date = new Date(),
  opts: PlaylistOptions = {}
): number[] {
  const caps = CAPS[mode];
  const pool = items.filter((i) => usable(i, mode, date));

  const affs = pool.filter((i) => i.type === 'AFFIRMATION').sort(byPriority).slice(0, caps.aff);
  const imgs = pool.filter((i) => i.type === 'IMAGING').sort(byPriority).slice(0, caps.img);

  // GOALS: LONG→MID→SHORT。QUICK/STANDARDは各階層の代表1件、FULLは全件
  const goals = pool.filter((i) => i.type === 'GOAL');
  let goalPick: ContentItem[];
  if (mode === 'full') {
    goalPick = [...goals].sort((a, b) => {
      const ha = HORIZON_ORDER[parseExtra<GoalExtra>(a).horizon ?? 'LONG'] ?? 0;
      const hb = HORIZON_ORDER[parseExtra<GoalExtra>(b).horizon ?? 'LONG'] ?? 0;
      if (ha !== hb) return ha - hb;
      return byPriority(a, b);
    });
  } else {
    goalPick = (['LONG', 'MID', 'SHORT'] as const).flatMap((h) => {
      const ofHorizon = goals
        .filter((g) => parseExtra<GoalExtra>(g).horizon === h)
        .sort(byPriority);
      return ofHorizon.length ? [ofHorizon[0]] : [];
    });
  }

  const nums = pool.filter((i) => i.type === 'NUMBER').sort(byPriority).slice(0, caps.num);

  const principles = pool.filter((i) => i.type === 'PRINCIPLE');
  const core = principles
    .filter((i) => parseExtra<PrincipleExtra>(i).role !== 'ROTATING')
    .sort(byPriority)
    .slice(0, caps.core);
  const rotating = principles
    .filter((i) => parseExtra<PrincipleExtra>(i).role === 'ROTATING')
    .sort((a, b) => {
      const d = rotationScore(b, date) - rotationScore(a, date);
      return d !== 0 ? d : a.id - b.id;
    })
    .slice(0, caps.rotating);

  let picked = [...affs, ...imgs, ...goalPick, ...nums, ...core, ...rotating];

  // FULLの安全弁: 長すぎる場合は優先度の低いものから間引く(順序は保つ)
  const max = mode === 'full' ? (opts.fullMaxItems ?? 40) : Infinity;
  if (picked.length > max) {
    const keep = new Set(
      [...picked].sort(byPriority).slice(0, max).map((i) => i.id)
    );
    picked = picked.filter((i) => keep.has(i.id));
  }

  return picked.map((i) => i.id);
}

// ---------- ステップ展開(プレイヤー用) ----------

export type RitualStep =
  | { kind: 'aff'; item: ContentItem }
  | { kind: 'imaging'; item: ContentItem }
  | { kind: 'goal'; item: ContentItem }
  | { kind: 'numbers-official'; items: ContentItem[] }
  | { kind: 'numbers-imaging'; items: ContentItem[] }
  | { kind: 'principle'; item: ContentItem }
  | { kind: 'complete' };

/**
 * プレイリスト(id列)を表示ステップへ展開する。
 * NUMBERは個別画面にせず「正式目標」→「イメージング目標」の2画面へまとめる。
 * 公式目標と唱える数字は同じ画面に混ぜない。
 */
export function expandSteps(items: ContentItem[], ids: number[]): RitualStep[] {
  const map = new Map(items.map((i) => [i.id, i]));
  const picked = ids.map((id) => map.get(id)).filter((i): i is ContentItem => i !== undefined);
  const steps: RitualStep[] = [];
  for (const i of picked.filter((x) => x.type === 'AFFIRMATION')) steps.push({ kind: 'aff', item: i });
  for (const i of picked.filter((x) => x.type === 'IMAGING')) steps.push({ kind: 'imaging', item: i });
  for (const i of picked.filter((x) => x.type === 'GOAL')) steps.push({ kind: 'goal', item: i });
  const nums = picked.filter((x) => x.type === 'NUMBER');
  if (nums.length > 0) {
    steps.push({ kind: 'numbers-official', items: nums });
    const withImaging = nums.filter((n) => {
      try {
        const ex = JSON.parse(n.extra) as { imagingTarget?: number | null };
        return ex.imagingTarget !== null && ex.imagingTarget !== undefined;
      } catch {
        return false;
      }
    });
    if (withImaging.length > 0) steps.push({ kind: 'numbers-imaging', items: withImaging });
  }
  for (const i of picked.filter((x) => x.type === 'PRINCIPLE')) steps.push({ kind: 'principle', item: i });
  steps.push({ kind: 'complete' });
  return steps;
}

/** TODAY画面の内訳表示用: プレイリストの種別ごとの件数 */
export function playlistCounts(items: ContentItem[], ids: number[]): Record<string, number> {
  const map = new Map(items.map((i) => [i.id, i]));
  const counts: Record<string, number> = { AFFIRMATION: 0, IMAGING: 0, GOAL: 0, NUMBER: 0, PRINCIPLE: 0 };
  for (const id of ids) {
    const item = map.get(id);
    if (item && counts[item.type] !== undefined) counts[item.type] += 1;
  }
  return counts;
}

/** 所要時間の目安(秒)。数字はまとめて2画面で表示するため別勘定 */
export function estimateSeconds(counts: Record<string, number>, secondsPerScreen: number): number {
  const screens =
    counts.AFFIRMATION + counts.IMAGING + counts.GOAL + (counts.NUMBER > 0 ? 2 : 0) + counts.PRINCIPLE + 1;
  return screens * secondsPerScreen;
}
