import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Affirmation,
  DailyLog,
  DailyLogField,
  Kpi,
  Principle,
  Quest,
  Scene,
  SettingKey,
} from './types';

// ---------- settings ----------

export async function getAllSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setSetting(db: SQLiteDatabase, key: SettingKey, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

// ---------- kpis ----------

export async function listKpis(db: SQLiteDatabase): Promise<Kpi[]> {
  return db.getAllAsync<Kpi>('SELECT * FROM kpis ORDER BY sort_order, id');
}

export async function updateKpiCurrent(db: SQLiteDatabase, id: number, current: number): Promise<void> {
  await db.runAsync('UPDATE kpis SET current_value = ? WHERE id = ?', current, id);
}

// ---------- principles ----------

export async function listPrinciples(db: SQLiteDatabase): Promise<Principle[]> {
  return db.getAllAsync<Principle>('SELECT * FROM principles ORDER BY sort_order, id');
}

export async function setPrincipleActive(db: SQLiteDatabase, id: number, active: boolean): Promise<void> {
  await db.runAsync('UPDATE principles SET active = ? WHERE id = ?', active ? 1 : 0, id);
}

// ---------- affirmations / scenes ----------

export async function listAffirmations(db: SQLiteDatabase): Promise<Affirmation[]> {
  return db.getAllAsync<Affirmation>('SELECT * FROM affirmations ORDER BY sort_order, id');
}

export async function listScenes(db: SQLiteDatabase): Promise<Scene[]> {
  return db.getAllAsync<Scene>('SELECT * FROM scenes ORDER BY sort_order, id');
}

// ---------- quests ----------

export async function listQuests(db: SQLiteDatabase): Promise<Quest[]> {
  return db.getAllAsync<Quest>('SELECT * FROM quests ORDER BY id');
}

export async function setQuestDone(db: SQLiteDatabase, id: number, done: boolean): Promise<void> {
  await db.runAsync('UPDATE quests SET done = ? WHERE id = ?', done ? 1 : 0, id);
}

// ---------- daily_log ----------

const EMPTY_LOG = (date: string): DailyLog => ({
  date,
  theater: 0,
  principle: 0,
  body_meditation: 0,
  body_diet: 0,
  body_training: 0,
});

export async function getDailyLog(db: SQLiteDatabase, date: string): Promise<DailyLog> {
  const row = await db.getFirstAsync<DailyLog>('SELECT * FROM daily_log WHERE date = ?', date);
  return row ?? EMPTY_LOG(date);
}

export async function setDailyLogField(
  db: SQLiteDatabase,
  date: string,
  field: DailyLogField,
  value: boolean
): Promise<DailyLog> {
  await db.runAsync(
    `INSERT INTO daily_log (date, ${field}) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET ${field} = excluded.${field}`,
    date,
    value ? 1 : 0
  );
  return getDailyLog(db, date);
}

export async function listDailyLogs(db: SQLiteDatabase): Promise<DailyLog[]> {
  return db.getAllAsync<DailyLog>('SELECT * FROM daily_log ORDER BY date');
}

// ---------- export ----------

export interface ExportData {
  exportedAt: string;
  settings: Record<string, string>;
  kpis: Kpi[];
  principles: Principle[];
  affirmations: Affirmation[];
  scenes: Scene[];
  quests: Quest[];
  dailyLogs: DailyLog[];
}

export async function exportAll(db: SQLiteDatabase): Promise<ExportData> {
  return {
    exportedAt: new Date().toISOString(),
    settings: await getAllSettings(db),
    kpis: await listKpis(db),
    principles: await listPrinciples(db),
    affirmations: await listAffirmations(db),
    scenes: await listScenes(db),
    quests: await listQuests(db),
    dailyLogs: await listDailyLogs(db),
  };
}
