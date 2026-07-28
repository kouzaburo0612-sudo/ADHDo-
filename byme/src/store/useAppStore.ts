import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as q from '../db/queries';
import type {
  ContentItem,
  ContentType,
  MergeLogRow,
  RitualMode,
  RitualSession,
  SettingKey,
} from '../db/types';
import { parseHHMM, todayKey } from '../lib/dates';
import { duplicateDetector, type DuplicateMatch } from '../lib/duplicates';
import { rescheduleAll } from '../lib/notifications';
import { buildPlaylist } from '../lib/playlist';
import { computeStats, type HabitStats } from '../lib/stats';

interface AppState {
  ready: boolean;
  settings: Record<string, string>;
  items: ContentItem[];
  sessions: RitualSession[];
  mergeLog: MergeLogRow[];
  stats: HabitStats;

  init: (db: SQLiteDatabase) => Promise<void>;
  reload: () => Promise<void>;
  saveSetting: (key: SettingKey, value: string) => Promise<void>;

  // 儀式セッション
  /** 今日の未完了セッション(続きから再開の対象) */
  todayInProgress: () => RitualSession | null;
  /** 今日の完了セッション(再閲覧の対象) */
  todayCompleted: () => RitualSession | null;
  /** セッションを開始 or 再開して返す */
  startOrResumeSession: (mode: RitualMode) => Promise<RitualSession>;
  /** 明示的な最初からやり直し(既存の途中セッションは離脱扱い) */
  restartSession: (mode: RitualMode) => Promise<RitualSession>;
  saveProgress: (sessionId: number, index: number, elapsed: number) => Promise<void>;
  finishSession: (session: RitualSession, elapsed: number) => Promise<void>;

  // MASTER CRUD
  addItem: (input: q.NewItemInput) => Promise<number>;
  editItem: (id: number, patch: q.ItemPatch) => Promise<void>;
  archive: (id: number) => Promise<void>;
  restore: (id: number) => Promise<void>;
  moveItem: (id: number, dir: -1 | 1) => Promise<void>;
  merge: (canonicalId: number, mergedId: number, reason: string) => Promise<void>;
  markIndependent: (id: number) => Promise<void>;
  /** 追加・編集時の類似チェック(同typeの有効項目と比較) */
  findSimilar: (type: ContentType, text: string, excludeId?: number) => Promise<DuplicateMatch<ContentItem>[]>;

  refreshNotifications: () => Promise<void>;
}

let _db: SQLiteDatabase | null = null;

function db(): SQLiteDatabase {
  if (!_db) throw new Error('DB not initialized');
  return _db;
}

const EMPTY_STATS: HabitStats = {
  todayDone: false,
  streak: 0,
  longestStreak: 0,
  monthDone: 0,
  monthDays: 1,
  rate30: 0,
  totalDays: 0,
  modeBreakdown: {},
  abandonedCount: 0,
  resumedCompletedCount: 0,
};

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: {},
  items: [],
  sessions: [],
  mergeLog: [],
  stats: EMPTY_STATS,

  init: async (database) => {
    _db = database;
    await get().reload();
    set({ ready: true });
    await get().refreshNotifications();
  },

  reload: async () => {
    const d = db();
    const [settings, items, sessions, mergeLog] = await Promise.all([
      q.getAllSettings(d),
      q.listItems(d),
      q.listSessions(d),
      q.listMergeLog(d),
    ]);
    set({ settings, items, sessions, mergeLog, stats: computeStats(sessions) });
  },

  saveSetting: async (key, value) => {
    await q.setSetting(db(), key, value);
    set({ settings: { ...get().settings, [key]: value } });
  },

  todayInProgress: () => {
    const today = todayKey();
    return (
      get().sessions.find((s) => s.date === today && s.status === 'IN_PROGRESS') ?? null
    );
  },

  todayCompleted: () => {
    const today = todayKey();
    return get().sessions.find((s) => s.date === today && s.status === 'COMPLETED') ?? null;
  },

  startOrResumeSession: async (mode) => {
    const existing = get().todayInProgress();
    if (existing && existing.mode === mode && existing.current_index > 0) {
      await q.markSessionResumed(db(), existing.id);
      const sessions = await q.listSessions(db());
      set({ sessions, stats: computeStats(sessions) });
      return sessions.find((s) => s.id === existing.id) ?? existing;
    }
    if (existing && existing.mode === mode) return existing;
    // モード違いの途中セッションが残っていたら離脱として畳む(途中でモード変更はしない)
    if (existing) await q.abandonSession(db(), existing.id);
    const { items, settings } = get();
    const playlist = buildPlaylist(items, mode, new Date(), {
      fullMaxItems: Number(settings.full_max_items ?? '40') || 40,
    });
    const session = await q.createSession(db(), todayKey(), mode, playlist);
    const sessions = await q.listSessions(db());
    set({ sessions, stats: computeStats(sessions) });
    return session;
  },

  restartSession: async (mode) => {
    const existing = get().todayInProgress();
    if (existing) await q.abandonSession(db(), existing.id);
    const { items, settings } = get();
    const playlist = buildPlaylist(items, mode, new Date(), {
      fullMaxItems: Number(settings.full_max_items ?? '40') || 40,
    });
    const session = await q.createSession(db(), todayKey(), mode, playlist);
    const sessions = await q.listSessions(db());
    set({ sessions, stats: computeStats(sessions) });
    return session;
  },

  saveProgress: async (sessionId, index, elapsed) => {
    await q.updateSessionProgress(db(), sessionId, index, elapsed);
    // 高頻度呼び出しのためローカルstateのみ軽く更新
    set({
      sessions: get().sessions.map((s) =>
        s.id === sessionId ? { ...s, current_index: index, elapsed_seconds: elapsed } : s
      ),
    });
  },

  finishSession: async (session, elapsed) => {
    const d = db();
    await q.completeSession(d, session.id, elapsed);
    // 表示された項目を実施済みとして記録(項目ごとのボタンは押させない)
    try {
      const ids: number[] = JSON.parse(session.playlist);
      await q.markItemsShown(d, ids, new Date().toISOString());
    } catch {
      // playlist破損時も完了自体は成立させる
    }
    await get().reload();
    await get().refreshNotifications();
  },

  addItem: async (input) => {
    const id = await q.insertItem(db(), input);
    await get().reload();
    return id;
  },

  editItem: async (id, patch) => {
    await q.updateItem(db(), id, patch);
    await get().reload();
  },

  archive: async (id) => {
    await q.archiveItem(db(), id);
    await get().reload();
  },

  restore: async (id) => {
    await q.restoreItem(db(), id);
    await get().reload();
  },

  moveItem: async (id, dir) => {
    const items = get().items;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const siblings = items
      .filter((i) => i.type === item.type && i.archived_at === null)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const idx = siblings.findIndex((i) => i.id === id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    await q.updateItem(db(), item.id, { sort_order: swap.sort_order });
    await q.updateItem(db(), swap.id, { sort_order: item.sort_order });
    await get().reload();
  },

  merge: async (canonicalId, mergedId, reason) => {
    await q.mergeItems(db(), canonicalId, mergedId, reason);
    await get().reload();
  },

  markIndependent: async (id) => {
    await q.updateItem(db(), id, { duplicate_status: 'independent', canonical_item_id: null });
    await get().reload();
  },

  findSimilar: async (type, text, excludeId) => {
    const candidates = get().items.filter(
      (i) =>
        i.type === type &&
        i.archived_at === null &&
        i.duplicate_status !== 'merged' &&
        i.id !== excludeId
    );
    return duplicateDetector.find(text, candidates);
  },

  refreshNotifications: async () => {
    const { settings, stats } = get();
    try {
      const days = (settings.notify_days ?? '0,1,2,3,4,5,6')
        .split(',')
        .map(Number)
        .filter((n) => n >= 0 && n <= 6);
      await rescheduleAll({
        wake: parseHHMM(settings.wake_time ?? '') ?? { hour: 6, minute: 0 },
        noon: parseHHMM(settings.noon_time ?? '') ?? { hour: 12, minute: 30 },
        evening: parseHHMM(settings.evening_time ?? '') ?? { hour: 17, minute: 30 },
        night: parseHHMM(settings.night_time ?? '') ?? { hour: 21, minute: 30 },
        morningEnabled: (settings.notify_morning_enabled ?? '1') === '1',
        noonEnabled: (settings.notify_noon_enabled ?? '1') === '1',
        eveningEnabled: (settings.notify_evening_enabled ?? '1') === '1',
        nightEnabled: (settings.notify_night_enabled ?? '1') === '1',
        days,
        todayComplete: stats.todayDone,
      });
    } catch {
      // 通知権限なし等は無視(設定画面から再許可できる)
    }
  },
}));
