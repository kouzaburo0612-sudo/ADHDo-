import type { SQLiteDatabase } from 'expo-sqlite';
import {
  AFFIRMATIONS,
  BODY_HABITS,
  IDENTITY,
  KPIS,
  MVV,
  PRINCIPLES,
  QUESTS,
  SCENES,
  SLEEP_RULES,
  THEME_2026,
} from '../data/master';
import {
  affirmationsToItems,
  bodyToItems,
  kpisToItems,
  markExactDuplicates,
  principlesToItems,
  questsToItems,
  roadmapToItems,
  scenesToItems,
  type NewItemSpec,
} from './migrateV6Data';
import type {
  LegacyAffirmation,
  LegacyDailyLog,
  LegacyKpi,
  LegacyPrinciple,
  LegacyQuest,
  LegacyScene,
} from './types';

/**
 * PRAGMA user_version によるマイグレーション。
 * v2〜v5: 旧「人生のコックピット」構造(kpis/principles/affirmations/scenes/quests/daily_log)。
 * v6: v3全面改修。全コンテンツを content_items に統合し、儀式を ritual_sessions で記録する。
 *     - 旧テーブルは削除せず残す(データ保全・ロールバック用の原本)
 *     - 文章は原文のまま移行し、完全一致の重複は「候補」としてマークのみ(自動削除しない)
 *     - daily_log の完了日は ritual_sessions(COMPLETED) として引き継ぐ
 */
const LATEST_VERSION = 6;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= LATEST_VERSION) return;

  if (current < 2) await migrateToV2(db);
  if (current < 3) await upsertTaikenQuests(db);
  if (current < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS reads (
        date TEXT NOT NULL,
        kind TEXT NOT NULL,
        item_id INTEGER NOT NULL,
        PRIMARY KEY (date, kind, item_id)
      );
    `);
  }
  if (current < 5) await upsertSeedPrinciples(db);
  if (current < 6) await migrateToV6(db);
  await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
}

// ---------- v6: content_items / ritual_sessions / merge_log ----------

async function migrateToV6(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS content_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 2,
      is_active INTEGER NOT NULL DEFAULT 1,
      cadence TEXT NOT NULL DEFAULT 'daily',
      modes TEXT NOT NULL DEFAULT 'standard,full',
      emphasis INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      extra TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_shown_at TEXT,
      show_count INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      canonical_item_id INTEGER,
      duplicate_status TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_items_type ON content_items(type, is_active);

    CREATE TABLE IF NOT EXISTS ritual_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mode TEXT NOT NULL,
      playlist TEXT NOT NULL DEFAULT '[]',
      current_index INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      elapsed_seconds INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      resumed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON ritual_sessions(date);

    CREATE TABLE IF NOT EXISTS merge_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_item_id INTEGER NOT NULL,
      merged_item_id INTEGER NOT NULL,
      merged_at TEXT NOT NULL,
      reason TEXT,
      original_title TEXT NOT NULL DEFAULT '',
      original_body TEXT NOT NULL DEFAULT ''
    );
  `);

  // 冪等ガード(移行済みなら何もしない)
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM content_items');
  if ((count?.c ?? 0) > 0) return;

  // 旧テーブルから原文を読む(旧テーブルが無い新規インストールではマスターから)
  const [kpis, principles, affirmations, scenes, quests, dailyLogs] = await Promise.all([
    readAll<LegacyKpi>(db, 'kpis'),
    readAll<LegacyPrinciple>(db, 'principles'),
    readAll<LegacyAffirmation>(db, 'affirmations'),
    readAll<LegacyScene>(db, 'scenes'),
    readAll<LegacyQuest>(db, 'quests'),
    readAll<LegacyDailyLog>(db, 'daily_log'),
  ]);

  const specs: NewItemSpec[] = [
    ...affirmationsToItems(affirmations.length ? affirmations : seedAffirmations()),
    ...scenesToItems(scenes.length ? scenes : seedScenes()),
    ...roadmapToItems(),
    ...kpisToItems(kpis.length ? kpis : seedKpis()),
    ...principlesToItems(principles.length ? principles : seedPrinciples()),
    ...questsToItems(quests),
    ...bodyToItems(BODY_HABITS, SLEEP_RULES),
  ];
  const dupMap = markExactDuplicates(specs);

  await db.withTransactionAsync(async () => {
    const now = new Date().toISOString();
    const insertedIds: number[] = [];
    for (const s of specs) {
      const res = await db.runAsync(
        `INSERT INTO content_items
           (type, title, body, priority, is_active, cadence, modes, emphasis, sort_order, extra, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.type,
        s.title,
        s.body,
        s.priority,
        s.is_active,
        s.cadence,
        s.modes,
        s.emphasis,
        s.sort_order,
        JSON.stringify(s.extra),
        now,
        now
      );
      insertedIds.push(res.lastInsertRowId);
    }
    // 完全一致は候補としてマークのみ(自動統合・削除はしない)
    for (const [dupIdx, canonIdx] of dupMap) {
      await db.runAsync(
        "UPDATE content_items SET duplicate_status = 'candidate', canonical_item_id = ? WHERE id = ?",
        insertedIds[canonIdx],
        insertedIds[dupIdx]
      );
    }
    // 旧daily_logの完了日をセッション履歴として引き継ぐ(ストリーク・累計の保全)
    for (const log of dailyLogs) {
      const complete =
        log.theater === 1 &&
        log.principle === 1 &&
        log.body_meditation === 1 &&
        log.body_diet === 1 &&
        log.body_training === 1;
      if (!complete) continue;
      await db.runAsync(
        `INSERT INTO ritual_sessions (date, mode, playlist, current_index, started_at, completed_at, elapsed_seconds, status)
         VALUES (?, 'standard', '[]', 0, ?, ?, 0, 'COMPLETED')`,
        log.date,
        `${log.date}T07:00:00.000Z`,
        `${log.date}T07:03:00.000Z`
      );
    }
    // 新設定のデフォルト
    const defaults: [string, string][] = [
      ['identity', IDENTITY],
      ['mvv_mission', MVV.mission],
      ['mvv_vision', MVV.vision],
      ['mvv_values_company', MVV.valuesCompany],
      ['theme_2026', THEME_2026],
      ['wake_time', '06:00'],
      ['default_mode', 'standard'],
      ['auto_advance', '0'],
      ['seconds_per_screen', '8'],
      ['tts_enabled', '0'],
      ['haptics_enabled', '1'],
      ['aff_display', 'split'],
      ['notify_morning_enabled', '1'],
      ['notify_noon_enabled', '1'],
      ['notify_evening_enabled', '1'],
      ['notify_night_enabled', '1'],
      ['notify_days', '0,1,2,3,4,5,6'],
      ['noon_time', '12:30'],
      ['evening_time', '17:30'],
      ['night_time', '21:30'],
      ['show_streak', '1'],
      ['show_rate', '1'],
      ['image_dim', '0.35'],
      ['font_scale', '1'],
      ['full_max_items', '40'],
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

async function readAll<T>(db: SQLiteDatabase, table: string): Promise<T[]> {
  try {
    return await db.getAllAsync<T>(`SELECT * FROM ${table}`);
  } catch {
    return [];
  }
}

// 新規インストール(旧テーブル空)用: マスターを旧行型に整形して同じ経路で投入する
function seedAffirmations(): LegacyAffirmation[] {
  return AFFIRMATIONS.map((a, i) => ({ id: i, title: a.title, body: a.body, scene_tag: null, sort_order: i }));
}
function seedScenes(): LegacyScene[] {
  return SCENES.map((s, i) => ({
    id: i,
    tag: s.tag,
    number_text: s.numberText,
    caption: s.caption,
    body: s.body,
    bg_gradient: s.gradient.join(','),
    sort_order: i,
  }));
}
function seedKpis(): LegacyKpi[] {
  return KPIS.map((k, i) => ({
    id: i,
    label: k.label,
    commit_value: k.commit,
    stretch_value: k.stretch,
    current_value: 0,
    unit: k.unit,
    deadline: k.deadline,
    linked_condition: k.linkedCondition,
    sort_order: i,
  }));
}
function seedPrinciples(): LegacyPrinciple[] {
  return PRINCIPLES.map((p, i) => ({ id: i, category: p.category, text: p.text, active: 1, sort_order: i }));
}

// ---------- 以下、旧バージョンのマイグレーション(既存ユーザーの段階適用用に残置) ----------

async function migrateToV2(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = 'wal';

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

  await seedV2(db);
}

const TAIKEN_RENAMES: [string, string][] = [
  ['加賀先生のアドバイス全実行', '加賀先生のアドバイスを全て実行する'],
  ['LA同じ家に75泊', 'ロサンゼルスの同じ家に75泊する'],
  ['中国', '中国滞在'],
  ['モンゴル', 'モンゴル滞在'],
  ['アフリカ', 'アフリカ滞在'],
  ['ドバイ', 'ドバイ滞在'],
  ['スペイン', 'スペイン滞在'],
  ['フランス', 'フランス滞在'],
  ['クロアチア', 'クロアチア滞在'],
  ['未踏欧州5カ国', '未踏ヨーロッパ5カ国滞在'],
  ['カナダ', 'カナダ滞在'],
  ['キューバ', 'キューバ滞在'],
  ['バリ再訪', 'バリ島再訪'],
  ['海外ポーカー100万勝つ', '海外のポーカーで100万勝つ'],
];

async function upsertSeedPrinciples(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < PRINCIPLES.length; i++) {
      const p = PRINCIPLES[i];
      const row = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM principles WHERE category = ? AND text = ?',
        p.category,
        p.text
      );
      if (row) {
        await db.runAsync('UPDATE principles SET sort_order = ? WHERE id = ?', i, row.id);
      } else {
        await db.runAsync(
          'INSERT INTO principles (category, text, sort_order) VALUES (?, ?, ?)',
          p.category,
          p.text,
          i
        );
      }
    }
  });
}

async function upsertTaikenQuests(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ title: string; done: number }>(
      "SELECT title, done FROM quests WHERE category = '体験'"
    );
    const doneByTitle = new Map(rows.map((r) => [r.title, r.done]));
    for (const [oldTitle, newTitle] of TAIKEN_RENAMES) {
      const oldDone = doneByTitle.get(oldTitle);
      if (oldDone !== undefined && !doneByTitle.has(newTitle)) {
        doneByTitle.set(newTitle, oldDone);
      }
    }
    await db.runAsync("DELETE FROM quests WHERE category = '体験'");
    for (const q of QUESTS.filter((x) => x.category === '体験')) {
      await db.runAsync(
        'INSERT INTO quests (category, title, done) VALUES (?, ?, ?)',
        q.category,
        q.title,
        doneByTitle.get(q.title) ?? (q.done ? 1 : 0)
      );
    }
  });
}

async function seedV2(db: SQLiteDatabase): Promise<void> {
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
