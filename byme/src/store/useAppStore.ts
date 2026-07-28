import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as q from '../db/queries';
import type {
  Affirmation,
  DailyLog,
  DailyLogField,
  Kpi,
  Principle,
  Quest,
  Scene,
  SettingKey,
} from '../db/types';
import { CREED } from '../data/master';
import { dayOfYear, parseHHMM, todayKey } from '../lib/dates';
import { computeStreak } from '../lib/streak';
import {
  scheduleMorningNotification,
  scheduleSundayKpiReminder,
} from '../lib/notifications';

interface AppState {
  ready: boolean;
  settings: Record<string, string>;
  kpis: Kpi[];
  principles: Principle[];
  affirmations: Affirmation[];
  scenes: Scene[];
  quests: Quest[];
  dailyLogs: DailyLog[];
  todayLog: DailyLog;
  streak: number;

  init: (db: SQLiteDatabase) => Promise<void>;
  reload: () => Promise<void>;

  saveSetting: (key: SettingKey, value: string) => Promise<void>;
  updateKpiCurrent: (id: number, current: number) => Promise<void>;
  togglePrinciple: (id: number, active: boolean) => Promise<void>;
  toggleQuest: (id: number, done: boolean) => Promise<void>;
  setTodayField: (field: DailyLogField, value: boolean) => Promise<void>;

  /** 朝通知(起床時刻・本文=今日の指針)と日曜KPI催促を再スケジュール */
  refreshNotifications: () => Promise<void>;
}

let _db: SQLiteDatabase | null = null;

function db(): SQLiteDatabase {
  if (!_db) throw new Error('DB not initialized');
  return _db;
}

const EMPTY_LOG: DailyLog = {
  date: '',
  theater: 0,
  principle: 0,
  body_meditation: 0,
  body_diet: 0,
  body_training: 0,
};

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: {},
  kpis: [],
  principles: [],
  affirmations: [],
  scenes: [],
  quests: [],
  dailyLogs: [],
  todayLog: EMPTY_LOG,
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
    const [settings, kpis, principles, affirmations, scenes, quests, dailyLogs, todayLog] =
      await Promise.all([
        q.getAllSettings(d),
        q.listKpis(d),
        q.listPrinciples(d),
        q.listAffirmations(d),
        q.listScenes(d),
        q.listQuests(d),
        q.listDailyLogs(d),
        q.getDailyLog(d, today),
      ]);
    set({
      settings,
      kpis,
      principles,
      affirmations,
      scenes,
      quests,
      dailyLogs,
      todayLog,
      streak: computeStreak(dailyLogs),
    });
  },

  saveSetting: async (key, value) => {
    await q.setSetting(db(), key, value);
    set({ settings: { ...get().settings, [key]: value } });
  },

  updateKpiCurrent: async (id, current) => {
    await q.updateKpiCurrent(db(), id, current);
    set({ kpis: await q.listKpis(db()) });
  },

  togglePrinciple: async (id, active) => {
    await q.setPrincipleActive(db(), id, active);
    set({ principles: await q.listPrinciples(db()) });
  },

  toggleQuest: async (id, done) => {
    await q.setQuestDone(db(), id, done);
    set({ quests: await q.listQuests(db()) });
  },

  setTodayField: async (field, value) => {
    const today = todayKey();
    const todayLog = await q.setDailyLogField(db(), today, field, value);
    const dailyLogs = await q.listDailyLogs(db());
    set({ todayLog, dailyLogs, streak: computeStreak(dailyLogs) });
  },

  refreshNotifications: async () => {
    const { settings, principles } = get();
    try {
      const wake = parseHHMM(settings.wake_time ?? '') ?? { hour: 6, minute: 0 };
      await scheduleMorningNotification(wake.hour, wake.minute, todaysGuidanceText(principles));
      await scheduleSundayKpiReminder((settings.notify_kpi_enabled ?? '1') === '1');
    } catch {
      // 通知権限なし等は無視(設定画面から再許可できる)
    }
  },
}));

// ---------- 派生ヘルパ ----------

/** 今日の戒め(3カ条から日替わり) */
export function todaysCreed(): string {
  return CREED[dayOfYear() % CREED.length];
}

/** 今日の心得: activeな項目からカテゴリ横断で日替わり1件 */
export function todaysPrinciple(principles: Principle[]): Principle | null {
  const active = principles.filter((p) => p.active === 1);
  if (active.length === 0) return null;
  return active[dayOfYear() % active.length];
}

/** 朝通知の本文: 戒め+心得を交互に(通知自体が刷り込み) */
export function todaysGuidanceText(principles: Principle[]): string {
  const p = todaysPrinciple(principles);
  const creed = todaysCreed();
  if (!p) return creed;
  return dayOfYear() % 2 === 0 ? p.text : creed;
}
