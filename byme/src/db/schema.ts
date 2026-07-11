import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * PRAGMA user_version によるマイグレーション。
 * SQLiteProvider の onInit から呼ばれる。
 */
const LATEST_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= LATEST_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('short','mid','long','life')),
        deadline TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS affirmations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        tag TEXT,
        goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        voice_uri TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS principles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT,
        text TEXT NOT NULL,
        is_preset INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS ritual_days (
        date TEXT PRIMARY KEY,
        declared INTEGER NOT NULL DEFAULT 0,
        principle INTEGER NOT NULL DEFAULT 0,
        journal INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        date TEXT PRIMARY KEY,
        gratitude TEXT NOT NULL DEFAULT '',
        progress TEXT NOT NULL DEFAULT '',
        vision TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
}
