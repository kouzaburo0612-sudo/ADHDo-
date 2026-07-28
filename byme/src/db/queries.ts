import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  ContentItem,
  ContentType,
  MergeLogRow,
  RitualMode,
  RitualSession,
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

// ---------- content_items ----------

export async function listItems(db: SQLiteDatabase): Promise<ContentItem[]> {
  return db.getAllAsync<ContentItem>('SELECT * FROM content_items ORDER BY type, sort_order, id');
}

export interface NewItemInput {
  type: ContentType;
  title: string;
  body: string;
  priority: number;
  cadence: string;
  modes: string;
  emphasis: number;
  extra: Record<string, unknown>;
  duplicate_status?: string | null;
}

export async function insertItem(db: SQLiteDatabase, input: NewItemInput): Promise<number> {
  const now = new Date().toISOString();
  const max = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM content_items WHERE type = ?',
    input.type
  );
  const res = await db.runAsync(
    `INSERT INTO content_items
       (type, title, body, priority, is_active, cadence, modes, emphasis, sort_order, extra, created_at, updated_at, duplicate_status)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.type,
    input.title,
    input.body,
    input.priority,
    input.cadence,
    input.modes,
    input.emphasis,
    (max?.m ?? 0) + 1,
    JSON.stringify(input.extra),
    now,
    now,
    input.duplicate_status ?? null
  );
  return res.lastInsertRowId;
}

export interface ItemPatch {
  title?: string;
  body?: string;
  priority?: number;
  is_active?: number;
  cadence?: string;
  modes?: string;
  emphasis?: number;
  sort_order?: number;
  extra?: Record<string, unknown>;
  duplicate_status?: string | null;
  canonical_item_id?: number | null;
}

export async function updateItem(db: SQLiteDatabase, id: number, patch: ItemPatch): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const push = (col: string, v: string | number | null) => {
    sets.push(`${col} = ?`);
    args.push(v);
  };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.body !== undefined) push('body', patch.body);
  if (patch.priority !== undefined) push('priority', patch.priority);
  if (patch.is_active !== undefined) push('is_active', patch.is_active);
  if (patch.cadence !== undefined) push('cadence', patch.cadence);
  if (patch.modes !== undefined) push('modes', patch.modes);
  if (patch.emphasis !== undefined) push('emphasis', patch.emphasis);
  if (patch.sort_order !== undefined) push('sort_order', patch.sort_order);
  if (patch.extra !== undefined) push('extra', JSON.stringify(patch.extra));
  if (patch.duplicate_status !== undefined) push('duplicate_status', patch.duplicate_status);
  if (patch.canonical_item_id !== undefined) push('canonical_item_id', patch.canonical_item_id);
  if (sets.length === 0) return;
  push('updated_at', new Date().toISOString());
  args.push(id);
  await db.runAsync(`UPDATE content_items SET ${sets.join(', ')} WHERE id = ?`, ...args);
}

/** 削除ではなくアーカイブ(復元可能) */
export async function archiveItem(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    'UPDATE content_items SET archived_at = ?, updated_at = ? WHERE id = ?',
    new Date().toISOString(),
    new Date().toISOString(),
    id
  );
}

export async function restoreItem(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    "UPDATE content_items SET archived_at = NULL, duplicate_status = CASE duplicate_status WHEN 'merged' THEN 'independent' ELSE duplicate_status END, updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    id
  );
}

/**
 * 重複統合: merged側をアーカイブ+'merged'にし、merge_logに原文を保全する。
 * 完全削除はしない。restoreItem で復元できる。
 */
export async function mergeItems(
  db: SQLiteDatabase,
  canonicalId: number,
  mergedId: number,
  reason: string
): Promise<void> {
  const merged = await db.getFirstAsync<ContentItem>('SELECT * FROM content_items WHERE id = ?', mergedId);
  if (!merged) return;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO merge_log (canonical_item_id, merged_item_id, merged_at, reason, original_title, original_body) VALUES (?, ?, ?, ?, ?, ?)',
      canonicalId,
      mergedId,
      now,
      reason,
      merged.title,
      merged.body
    );
    await db.runAsync(
      "UPDATE content_items SET archived_at = ?, duplicate_status = 'merged', canonical_item_id = ?, updated_at = ? WHERE id = ?",
      now,
      canonicalId,
      now,
      mergedId
    );
  });
}

export async function listMergeLog(db: SQLiteDatabase): Promise<MergeLogRow[]> {
  return db.getAllAsync<MergeLogRow>('SELECT * FROM merge_log ORDER BY merged_at DESC');
}

/** 儀式完了時: 表示された項目を実施済みとして記録する */
export async function markItemsShown(db: SQLiteDatabase, ids: number[], at: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        'UPDATE content_items SET last_shown_at = ?, show_count = show_count + 1 WHERE id = ?',
        at,
        id
      );
    }
  });
}

// ---------- ritual_sessions ----------

export async function listSessions(db: SQLiteDatabase): Promise<RitualSession[]> {
  return db.getAllAsync<RitualSession>('SELECT * FROM ritual_sessions ORDER BY date, started_at');
}

export async function getSessionsForDate(db: SQLiteDatabase, date: string): Promise<RitualSession[]> {
  return db.getAllAsync<RitualSession>(
    'SELECT * FROM ritual_sessions WHERE date = ? ORDER BY started_at',
    date
  );
}

export async function createSession(
  db: SQLiteDatabase,
  date: string,
  mode: RitualMode,
  playlist: number[]
): Promise<RitualSession> {
  const now = new Date().toISOString();
  const res = await db.runAsync(
    `INSERT INTO ritual_sessions (date, mode, playlist, current_index, started_at, status)
     VALUES (?, ?, ?, 0, ?, 'IN_PROGRESS')`,
    date,
    mode,
    JSON.stringify(playlist),
    now
  );
  const row = await db.getFirstAsync<RitualSession>(
    'SELECT * FROM ritual_sessions WHERE id = ?',
    res.lastInsertRowId
  );
  if (!row) throw new Error('session insert failed');
  return row;
}

export async function updateSessionProgress(
  db: SQLiteDatabase,
  id: number,
  currentIndex: number,
  elapsedSeconds: number
): Promise<void> {
  await db.runAsync(
    'UPDATE ritual_sessions SET current_index = ?, elapsed_seconds = ? WHERE id = ?',
    currentIndex,
    elapsedSeconds,
    id
  );
}

export async function markSessionResumed(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE ritual_sessions SET resumed = resumed + 1 WHERE id = ?', id);
}

export async function completeSession(db: SQLiteDatabase, id: number, elapsedSeconds: number): Promise<void> {
  await db.runAsync(
    "UPDATE ritual_sessions SET status = 'COMPLETED', completed_at = ?, elapsed_seconds = ? WHERE id = ?",
    new Date().toISOString(),
    elapsedSeconds,
    id
  );
}

export async function abandonSession(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE ritual_sessions SET status = 'ABANDONED' WHERE id = ?", id);
}

// ---------- export / import ----------

export interface ExportData {
  exportedAt: string;
  version: 3;
  settings: Record<string, string>;
  items: ContentItem[];
  sessions: RitualSession[];
  mergeLog: MergeLogRow[];
}

export async function exportAll(db: SQLiteDatabase): Promise<ExportData> {
  return {
    exportedAt: new Date().toISOString(),
    version: 3,
    settings: await getAllSettings(db),
    items: await listItems(db),
    sessions: await listSessions(db),
    mergeLog: await listMergeLog(db),
  };
}
