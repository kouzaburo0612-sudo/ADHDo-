/**
 * ローカルDB (expo-sqlite)
 * HealthKitデータのキャッシュ・タグ・AIレポート・設定を保存する。
 * HealthKitへの都度クエリを避け、トレンド表示と過去参照を高速にするのが目的。
 */
import * as SQLite from 'expo-sqlite';

import type { MetricKey } from '@/lib/metrics';

const db = SQLite.openDatabaseSync('master-health.db');

db.execAsync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS daily_metrics (
    date TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    PRIMARY KEY (date, metric)
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_metric ON daily_metrics(metric, date);
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS custom_tags (
    name TEXT PRIMARY KEY,
    emoji TEXT NOT NULL DEFAULT '🏷'
  );
  CREATE TABLE IF NOT EXISTS ai_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (kind, date)
  );
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`).catch((e) => console.warn('DB init failed', e));

export interface MetricRow {
  date: string;
  metric: MetricKey;
  value: number;
}

export interface TagRow {
  id: number;
  date: string;
  tag: string;
}

export interface ReportRow {
  id: number;
  kind: 'daily' | 'weekly' | 'anomaly';
  date: string;
  content: string;
  created_at: string;
}

// ---- metrics ----

export async function upsertMetrics(rows: MetricRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      await db.runAsync(
        'INSERT INTO daily_metrics (date, metric, value) VALUES (?, ?, ?) ON CONFLICT(date, metric) DO UPDATE SET value = excluded.value',
        r.date, r.metric, r.value,
      );
    }
  });
}

/** 指定指標の期間データ(date昇順) */
export async function getSeries(metric: MetricKey, fromDate: string, toDate: string): Promise<MetricRow[]> {
  return db.getAllAsync<MetricRow>(
    'SELECT date, metric, value FROM daily_metrics WHERE metric = ? AND date BETWEEN ? AND ? ORDER BY date',
    metric, fromDate, toDate,
  );
}

/** 1日分の全指標 */
export async function getDay(date: string): Promise<Partial<Record<MetricKey, number>>> {
  const rows = await db.getAllAsync<MetricRow>(
    'SELECT date, metric, value FROM daily_metrics WHERE date = ?', date,
  );
  const out: Partial<Record<MetricKey, number>> = {};
  for (const r of rows) out[r.metric] = r.value;
  return out;
}

/** 期間内の全指標(日付キー → 指標マップ) */
export async function getRange(fromDate: string, toDate: string): Promise<Map<string, Partial<Record<MetricKey, number>>>> {
  const rows = await db.getAllAsync<MetricRow>(
    'SELECT date, metric, value FROM daily_metrics WHERE date BETWEEN ? AND ? ORDER BY date',
    fromDate, toDate,
  );
  const map = new Map<string, Partial<Record<MetricKey, number>>>();
  for (const r of rows) {
    const day = map.get(r.date) ?? {};
    day[r.metric] = r.value;
    map.set(r.date, day);
  }
  return map;
}

// ---- tags ----

export async function addTag(date: string, tag: string): Promise<void> {
  await db.runAsync('INSERT INTO tags (date, tag) VALUES (?, ?)', date, tag);
}

export async function removeTag(date: string, tag: string): Promise<void> {
  await db.runAsync(
    'DELETE FROM tags WHERE id IN (SELECT id FROM tags WHERE date = ? AND tag = ? LIMIT 1)',
    date, tag,
  );
}

export async function getTags(date: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ tag: string }>('SELECT tag FROM tags WHERE date = ?', date);
  return rows.map((r) => r.tag);
}

/** タグ名 → 記録された日付一覧(相関分析用) */
export async function getTagDates(): Promise<Map<string, string[]>> {
  const rows = await db.getAllAsync<{ date: string; tag: string }>('SELECT DISTINCT date, tag FROM tags');
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const arr = map.get(r.tag) ?? [];
    arr.push(r.date);
    map.set(r.tag, arr);
  }
  return map;
}

export async function getCustomTags(): Promise<{ name: string; emoji: string }[]> {
  return db.getAllAsync<{ name: string; emoji: string }>('SELECT name, emoji FROM custom_tags ORDER BY name');
}

export async function addCustomTag(name: string, emoji: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO custom_tags (name, emoji) VALUES (?, ?)', name, emoji);
}

// ---- AI reports ----

export async function saveReport(kind: ReportRow['kind'], date: string, content: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO ai_reports (kind, date, content) VALUES (?, ?, ?) ON CONFLICT(kind, date) DO UPDATE SET content = excluded.content, created_at = datetime(\'now\')',
    kind, date, content,
  );
}

export async function getReport(kind: ReportRow['kind'], date: string): Promise<ReportRow | null> {
  return db.getFirstAsync<ReportRow>(
    'SELECT * FROM ai_reports WHERE kind = ? AND date = ?', kind, date,
  );
}

export async function listReports(kind: ReportRow['kind'], limit = 12): Promise<ReportRow[]> {
  return db.getAllAsync<ReportRow>(
    'SELECT * FROM ai_reports WHERE kind = ? ORDER BY date DESC LIMIT ?', kind, limit,
  );
}

// ---- kv ----

export async function kvGet(key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
}
