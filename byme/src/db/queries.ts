import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Affirmation,
  Goal,
  GoalCategory,
  JournalEntry,
  Principle,
  RitualDay,
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

// ---------- goals ----------

export async function listGoals(db: SQLiteDatabase): Promise<Goal[]> {
  return db.getAllAsync<Goal>(
    'SELECT * FROM goals WHERE archived = 0 ORDER BY sort_order, id'
  );
}

export async function insertGoal(
  db: SQLiteDatabase,
  g: { title: string; category: GoalCategory; deadline: string | null }
): Promise<number> {
  const max = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM goals WHERE category = ?',
    g.category
  );
  const res = await db.runAsync(
    'INSERT INTO goals (title, category, deadline, sort_order) VALUES (?, ?, ?, ?)',
    g.title,
    g.category,
    g.deadline,
    (max?.m ?? 0) + 1
  );
  return res.lastInsertRowId;
}

export async function updateGoal(
  db: SQLiteDatabase,
  id: number,
  g: { title: string; category: GoalCategory; deadline: string | null }
): Promise<void> {
  await db.runAsync(
    'UPDATE goals SET title = ?, category = ?, deadline = ? WHERE id = ?',
    g.title,
    g.category,
    g.deadline,
    id
  );
}

export async function archiveGoal(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE goals SET archived = 1 WHERE id = ?', id);
}

// ---------- affirmations ----------

export async function listAffirmations(db: SQLiteDatabase, onlyActive = false): Promise<Affirmation[]> {
  return db.getAllAsync<Affirmation>(
    onlyActive
      ? 'SELECT * FROM affirmations WHERE active = 1 ORDER BY sort_order, id'
      : 'SELECT * FROM affirmations ORDER BY sort_order, id'
  );
}

export async function insertAffirmation(
  db: SQLiteDatabase,
  a: { text: string; tag: string | null; goal_id: number | null }
): Promise<number> {
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM affirmations');
  const res = await db.runAsync(
    'INSERT INTO affirmations (text, tag, goal_id, sort_order) VALUES (?, ?, ?, ?)',
    a.text,
    a.tag,
    a.goal_id,
    (max?.m ?? 0) + 1
  );
  return res.lastInsertRowId;
}

export async function updateAffirmationText(
  db: SQLiteDatabase,
  id: number,
  text: string,
  tag: string | null
): Promise<void> {
  await db.runAsync('UPDATE affirmations SET text = ?, tag = ? WHERE id = ?', text, tag, id);
}

export async function setAffirmationActive(db: SQLiteDatabase, id: number, active: boolean): Promise<void> {
  await db.runAsync('UPDATE affirmations SET active = ? WHERE id = ?', active ? 1 : 0, id);
}

export async function deleteAffirmation(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM affirmations WHERE id = ?', id);
}

// ---------- principles ----------

export async function listPrinciples(db: SQLiteDatabase): Promise<Principle[]> {
  return db.getAllAsync<Principle>('SELECT * FROM principles ORDER BY id');
}

export async function insertPrinciple(
  db: SQLiteDatabase,
  p: { source: string | null; text: string; is_preset?: boolean }
): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO principles (source, text, is_preset) VALUES (?, ?, ?)',
    p.source,
    p.text,
    p.is_preset ? 1 : 0
  );
  return res.lastInsertRowId;
}

export async function updatePrinciple(
  db: SQLiteDatabase,
  id: number,
  p: { source: string | null; text: string }
): Promise<void> {
  await db.runAsync('UPDATE principles SET source = ?, text = ? WHERE id = ?', p.source, p.text, id);
}

export async function setPrincipleActive(db: SQLiteDatabase, id: number, active: boolean): Promise<void> {
  await db.runAsync('UPDATE principles SET active = ? WHERE id = ?', active ? 1 : 0, id);
}

export async function deletePrinciple(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM principles WHERE id = ?', id);
}

export async function insertPrinciplesBulk(
  db: SQLiteDatabase,
  items: { source: string | null; text: string }[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const p of items) {
      await db.runAsync(
        'INSERT INTO principles (source, text, is_preset) VALUES (?, ?, 1)',
        p.source,
        p.text
      );
    }
  });
}

// ---------- ritual_days ----------

export async function getRitualDay(db: SQLiteDatabase, date: string): Promise<RitualDay> {
  const row = await db.getFirstAsync<RitualDay>('SELECT * FROM ritual_days WHERE date = ?', date);
  return row ?? { date, declared: 0, principle: 0, journal: 0, completed_at: null };
}

export async function markRitual(
  db: SQLiteDatabase,
  date: string,
  field: 'declared' | 'principle' | 'journal'
): Promise<RitualDay> {
  await db.runAsync(
    `INSERT INTO ritual_days (date, ${field}) VALUES (?, 1)
     ON CONFLICT(date) DO UPDATE SET ${field} = 1`,
    date
  );
  // 3項目そろったら completed_at を刻む(1回だけ)
  await db.runAsync(
    `UPDATE ritual_days SET completed_at = datetime('now')
     WHERE date = ? AND declared = 1 AND principle = 1 AND journal = 1 AND completed_at IS NULL`,
    date
  );
  return getRitualDay(db, date);
}

/** 3項目完了した日付の集合(ストリーク・ヒートマップ用) */
export async function listRitualDays(db: SQLiteDatabase): Promise<RitualDay[]> {
  return db.getAllAsync<RitualDay>('SELECT * FROM ritual_days ORDER BY date');
}

// ---------- journal ----------

export async function getJournal(db: SQLiteDatabase, date: string): Promise<JournalEntry | null> {
  return db.getFirstAsync<JournalEntry>('SELECT * FROM journal_entries WHERE date = ?', date);
}

export async function upsertJournal(db: SQLiteDatabase, e: JournalEntry): Promise<void> {
  await db.runAsync(
    `INSERT INTO journal_entries (date, gratitude, progress, vision) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET gratitude = excluded.gratitude, progress = excluded.progress, vision = excluded.vision`,
    e.date,
    e.gratitude,
    e.progress,
    e.vision
  );
}

export async function listJournal(db: SQLiteDatabase, limit = 60): Promise<JournalEntry[]> {
  return db.getAllAsync<JournalEntry>(
    'SELECT * FROM journal_entries ORDER BY date DESC LIMIT ?',
    limit
  );
}

// ---------- export ----------

export interface ExportData {
  exportedAt: string;
  settings: Record<string, string>;
  goals: Goal[];
  affirmations: Affirmation[];
  principles: Principle[];
  ritualDays: RitualDay[];
  journal: JournalEntry[];
}

export async function exportAll(db: SQLiteDatabase): Promise<ExportData> {
  return {
    exportedAt: new Date().toISOString(),
    settings: await getAllSettings(db),
    goals: await db.getAllAsync<Goal>('SELECT * FROM goals'),
    affirmations: await listAffirmations(db),
    principles: await listPrinciples(db),
    ritualDays: await listRitualDays(db),
    journal: await db.getAllAsync<JournalEntry>('SELECT * FROM journal_entries ORDER BY date'),
  };
}
