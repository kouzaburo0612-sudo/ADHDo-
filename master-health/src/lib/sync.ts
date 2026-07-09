/** HealthKit → SQLite 同期 */
import { kvGet, kvSet, upsertMetrics } from '@/lib/db';
import { addDays, fromKey } from '@/lib/dates';
import { fetchDailyMetrics, healthAvailable } from '@/lib/healthkit';

const LAST_SYNC_KEY = 'last_sync_date';
/** 初回はトレンド年表示のため400日分取得 */
const INITIAL_DAYS = 400;
/** 2回目以降は直近14日を取り直す(後から同期されるOura/Withingsデータを拾う) */
const INCREMENTAL_DAYS = 14;

export async function syncHealthData(force = false): Promise<{ synced: number }> {
  if (!healthAvailable()) return { synced: 0 };

  const last = await kvGet(LAST_SYNC_KEY);
  let start: Date;
  if (!last || force) {
    start = addDays(new Date(), -INITIAL_DAYS);
  } else {
    const lastDate = fromKey(last);
    start = addDays(lastDate, -INCREMENTAL_DAYS);
  }

  const rows = await fetchDailyMetrics(start);
  await upsertMetrics(rows);
  await kvSet(LAST_SYNC_KEY, new Date().toISOString().slice(0, 10));
  return { synced: rows.length };
}

export async function lastSyncDate(): Promise<string | null> {
  return kvGet(LAST_SYNC_KEY);
}
