import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as q from '../db/queries';
import type {
  Affirmation,
  Goal,
  GoalCategory,
  JournalEntry,
  Principle,
  RitualDay,
  SettingKey,
} from '../db/types';
import { dayOfYear, parseHHMM, todayKey } from '../lib/dates';
import { computeStreak } from '../lib/streak';
import {
  refreshEveningReminder,
  scheduleMorningNotification,
} from '../lib/notifications';

interface AppState {
  ready: boolean;
  settings: Record<string, string>;
  goals: Goal[];
  affirmations: Affirmation[];
  principles: Principle[];
  ritualDays: RitualDay[];
  todayRitual: RitualDay;
  todayJournal: JournalEntry | null;
  streak: number;

  init: (db: SQLiteDatabase) => Promise<void>;
  reload: () => Promise<void>;

  saveSetting: (key: SettingKey, value: string) => Promise<void>;

  addGoal: (g: { title: string; category: GoalCategory; deadline: string | null }) => Promise<number>;
  editGoal: (id: number, g: { title: string; category: GoalCategory; deadline: string | null }) => Promise<void>;
  removeGoal: (id: number) => Promise<void>;

  addAffirmation: (a: { text: string; tag: string | null; goal_id: number | null }) => Promise<void>;
  editAffirmation: (id: number, text: string, tag: string | null) => Promise<void>;
  toggleAffirmation: (id: number, active: boolean) => Promise<void>;
  removeAffirmation: (id: number) => Promise<void>;

  addPrinciple: (p: { source: string | null; text: string }) => Promise<void>;
  editPrinciple: (id: number, p: { source: string | null; text: string }) => Promise<void>;
  togglePrinciple: (id: number, active: boolean) => Promise<void>;
  removePrinciple: (id: number) => Promise<void>;
  installPresets: (items: { source: string | null; text: string }[]) => Promise<void>;

  markRitual: (field: 'declared' | 'principle' | 'journal') => Promise<void>;
  saveJournal: (e: Omit<JournalEntry, 'date'>) => Promise<void>;

  /** 朝の宣言通知と21時リマインドを現在の状態に合わせて再スケジュール */
  refreshNotifications: () => Promise<void>;
}

let _db: SQLiteDatabase | null = null;

function db(): SQLiteDatabase {
  if (!_db) throw new Error('DB not initialized');
  return _db;
}

const EMPTY_RITUAL: RitualDay = {
  date: '',
  declared: 0,
  principle: 0,
  journal: 0,
  completed_at: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: {},
  goals: [],
  affirmations: [],
  principles: [],
  ritualDays: [],
  todayRitual: EMPTY_RITUAL,
  todayJournal: null,
  streak: 0,

  init: async (database) => {
    _db = database;
    await get().reload();
    set({ ready: true });
    await get().refreshNotifications();
  },

  reload: async () => {
    const d = db();
    const today = todayKey();
    const [settings, goals, affirmations, principles, ritualDays, todayRitual, todayJournal] =
      await Promise.all([
        q.getAllSettings(d),
        q.listGoals(d),
        q.listAffirmations(d),
        q.listPrinciples(d),
        q.listRitualDays(d),
        q.getRitualDay(d, today),
        q.getJournal(d, today),
      ]);
    set({
      settings,
      goals,
      affirmations,
      principles,
      ritualDays,
      todayRitual,
      todayJournal,
      streak: computeStreak(ritualDays),
    });
  },

  saveSetting: async (key, value) => {
    await q.setSetting(db(), key, value);
    set({ settings: { ...get().settings, [key]: value } });
  },

  addGoal: async (g) => {
    const id = await q.insertGoal(db(), g);
    set({ goals: await q.listGoals(db()) });
    return id;
  },
  editGoal: async (id, g) => {
    await q.updateGoal(db(), id, g);
    set({ goals: await q.listGoals(db()) });
  },
  removeGoal: async (id) => {
    await q.archiveGoal(db(), id);
    set({ goals: await q.listGoals(db()) });
  },

  addAffirmation: async (a) => {
    await q.insertAffirmation(db(), a);
    set({ affirmations: await q.listAffirmations(db()) });
  },
  editAffirmation: async (id, text, tag) => {
    await q.updateAffirmationText(db(), id, text, tag);
    set({ affirmations: await q.listAffirmations(db()) });
  },
  toggleAffirmation: async (id, active) => {
    await q.setAffirmationActive(db(), id, active);
    set({ affirmations: await q.listAffirmations(db()) });
  },
  removeAffirmation: async (id) => {
    await q.deleteAffirmation(db(), id);
    set({ affirmations: await q.listAffirmations(db()) });
  },

  addPrinciple: async (p) => {
    await q.insertPrinciple(db(), p);
    set({ principles: await q.listPrinciples(db()) });
  },
  editPrinciple: async (id, p) => {
    await q.updatePrinciple(db(), id, p);
    set({ principles: await q.listPrinciples(db()) });
  },
  togglePrinciple: async (id, active) => {
    await q.setPrincipleActive(db(), id, active);
    set({ principles: await q.listPrinciples(db()) });
  },
  removePrinciple: async (id) => {
    await q.deletePrinciple(db(), id);
    set({ principles: await q.listPrinciples(db()) });
  },
  installPresets: async (items) => {
    await q.insertPrinciplesBulk(db(), items);
    set({ principles: await q.listPrinciples(db()) });
  },

  markRitual: async (field) => {
    const today = todayKey();
    const todayRitual = await q.markRitual(db(), today, field);
    const ritualDays = await q.listRitualDays(db());
    set({ todayRitual, ritualDays, streak: computeStreak(ritualDays) });
    if (field === 'journal') {
      await get().refreshNotifications();
    }
  },

  saveJournal: async (e) => {
    const today = todayKey();
    const entry: JournalEntry = { date: today, ...e };
    await q.upsertJournal(db(), entry);
    set({ todayJournal: entry });
    await get().markRitual('journal');
  },

  refreshNotifications: async () => {
    const { settings, todayRitual } = get();
    try {
      const morning = parseHHMM(settings.notify_morning ?? '');
      if (morning) {
        await scheduleMorningNotification(
          morning.hour,
          morning.minute,
          todaysAffirmationText(get().affirmations)
        );
      }
      const eveningEnabled = (settings.notify_evening_enabled ?? '1') === '1';
      await refreshEveningReminder(eveningEnabled, todayRitual.journal === 1);
    } catch {
      // 通知権限なし等は無視(設定画面から再許可できる)
    }
  },
}));

// ---------- セレクタ/派生ヘルパ ----------

export function activeAffirmations(affirmations: Affirmation[]): Affirmation[] {
  return affirmations.filter((a) => a.active === 1);
}

/** 通知本文用: 今日の宣言文(アクティブな宣言からローテーション) */
export function todaysAffirmationText(affirmations: Affirmation[]): string {
  const active = activeAffirmations(affirmations);
  if (active.length === 0) return 'なりたい自分として、今日を始めよう。';
  return active[dayOfYear() % active.length].text;
}

/** 1日1心得: アクティブな心得から dayOfYear % count でローテーション */
export function todaysPrinciple(principles: Principle[]): Principle | null {
  const active = principles.filter((p) => p.active === 1);
  if (active.length === 0) return null;
  return active[dayOfYear() % active.length];
}
