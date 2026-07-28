import type { SQLiteDatabase } from 'expo-sqlite';
import {
  AFFIRMATIONS,
  IDENTITY,
  KPIS,
  MVV,
  PRINCIPLES,
  QUESTS,
  SCENES,
  THEME_2026,
} from '../data/master';

/**
 * PRAGMA user_version によるマイグレーション。
 * v2: 「人生のコックピット」への全面改修。
 *     v1(目標/宣言文/儀式ログ/日記)のテーブルは破棄し、
 *     マスターコンテンツをシードとして投入する。
 */
const LATEST_VERSION = 2;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= LATEST_VERSION) return;

  await db.execAsync(`
    PRAGMA journal_mode = 'wal';

    -- v1のテーブルを破棄(v2は本人専用シードから始める)
    DROP TABLE IF EXISTS goals;
    DROP TABLE IF EXISTS affirmations;
    DROP TABLE IF EXISTS principles;
    DROP TABLE IF EXISTS ritual_days;
    DROP TABLE IF EXISTS journal_entries;

    CREATE TABLE IF NOT EXISTS kpis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      commit_value REAL NOT NULL,
      stretch_value REAL,
      current_value REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      deadline TEXT NOT NULL,
      linked_condition TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS principles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      text TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS affirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      scene_tag TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL,
      number_text TEXT NOT NULL,
      caption TEXT NOT NULL,
      body TEXT NOT NULL,
      bg_gradient TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_log (
      date TEXT PRIMARY KEY,
      theater INTEGER NOT NULL DEFAULT 0,
      principle INTEGER NOT NULL DEFAULT 0,
      body_meditation INTEGER NOT NULL DEFAULT 0,
      body_diet INTEGER NOT NULL DEFAULT 0,
      body_training INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await seed(db);
  await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
}

/** マスターコンテンツ(byme-master-content §1〜4)を投入する。冪等。 */
async function seed(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const kpiCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM kpis');
    if ((kpiCount?.c ?? 0) === 0) {
      for (let i = 0; i < KPIS.length; i++) {
        const k = KPIS[i];
        await db.runAsync(
          `INSERT INTO kpis (label, commit_value, stretch_value, unit, deadline, linked_condition, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          k.label,
          k.commit,
          k.stretch,
          k.unit,
          k.deadline,
          k.linkedCondition,
          i
        );
      }
    }

    const prCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM principles');
    if ((prCount?.c ?? 0) === 0) {
      for (let i = 0; i < PRINCIPLES.length; i++) {
        const p = PRINCIPLES[i];
        await db.runAsync(
          'INSERT INTO principles (category, text, sort_order) VALUES (?, ?, ?)',
          p.category,
          p.text,
          i
        );
      }
    }

    const afCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM affirmations');
    if ((afCount?.c ?? 0) === 0) {
      for (let i = 0; i < AFFIRMATIONS.length; i++) {
        const a = AFFIRMATIONS[i];
        await db.runAsync(
          'INSERT INTO affirmations (title, body, sort_order) VALUES (?, ?, ?)',
          a.title,
          a.body,
          i
        );
      }
    }

    const scCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM scenes');
    if ((scCount?.c ?? 0) === 0) {
      for (let i = 0; i < SCENES.length; i++) {
        const s = SCENES[i];
        await db.runAsync(
          'INSERT INTO scenes (tag, number_text, caption, body, bg_gradient, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
          s.tag,
          s.numberText,
          s.caption,
          s.body,
          s.gradient.join(','),
          i
        );
      }
    }

    const qCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM quests');
    if ((qCount?.c ?? 0) === 0) {
      for (const q of QUESTS) {
        await db.runAsync(
          'INSERT INTO quests (category, title, done) VALUES (?, ?, ?)',
          q.category,
          q.title,
          q.done ? 1 : 0
        );
      }
    }

    const defaults: [string, string][] = [
      ['identity', IDENTITY],
      ['mvv_mission', MVV.mission],
      ['mvv_vision', MVV.vision],
      ['mvv_values_company', MVV.valuesCompany],
      ['theme_2026', THEME_2026],
      ['wake_time', '06:00'],
      ['notify_kpi_enabled', '1'],
    ];
    for (const [key, value] of defaults) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
        key,
        value
      );
    }
  });
}
