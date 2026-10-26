/**
 * Oura API v2 直接連携(Personal Access Token方式)
 * ================================================
 * ヘルスケア経由では取れないOura独自スコア(レディネス・睡眠スコア・
 * アクティビティスコア・体表温偏差)をAPIから直接取得してmetricsに保存する。
 * トークンは https://cloud.ouraring.com/personal-access-tokens で発行し、
 * 設定画面から入力(端末のセキュア領域にのみ保存)。
 */
import * as SecureStore from 'expo-secure-store';

import { kvGet, kvSet, upsertMetrics, type MetricRow } from '@/lib/db';
import { addDays, toKey } from '@/lib/dates';

const TOKEN_KEY = 'oura_pat';
const BASE = 'https://api.ouraring.com/v2/usercollection';

export async function getOuraToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}

export async function setOuraToken(token: string): Promise<void> {
  if (token.trim() === '') await SecureStore.deleteItemAsync(TOKEN_KEY);
  else await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
}

interface OuraDaily { day: string; score?: number }
interface OuraReadiness extends OuraDaily { temperature_deviation?: number | null }

async function fetchAll<T>(token: string, path: string, startDate: string, endDate: string): Promise<T[]> {
  const out: T[] = [];
  let nextToken: string | null = null;
  for (let page = 0; page < 10; page++) {
    const url = `${BASE}/${path}?start_date=${startDate}&end_date=${endDate}${nextToken ? `&next_token=${nextToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new Error('OURA_BAD_TOKEN');
    if (!res.ok) throw new Error(`OURA_API_${res.status}`);
    const j: { data?: T[]; next_token?: string | null } = await res.json();
    out.push(...(j.data ?? []));
    nextToken = j.next_token ?? null;
    if (!nextToken) break;
  }
  return out;
}

/** 直近の同期結果(種別ごとの件数/エラー)。設定画面での原因切り分け用 */
export interface OuraDiag {
  at: string;
  readiness: string;
  sleep: string;
  activity: string;
}

export async function getOuraDiag(): Promise<OuraDiag | null> {
  try {
    const v = await kvGet('oura_sync_diag');
    return v ? (JSON.parse(v) as OuraDiag) : null;
  } catch { return null; }
}

const errLabel = (e: unknown): string =>
  `エラー(${e instanceof Error ? e.message : String(e)})`;

/**
 * Ouraスコア類を同期する。トークン未設定なら何もしない。
 * 種別ごとに独立して取得し、1つの失敗が他を巻き込まないようにする。
 * 結果(件数/エラー)はkv 'oura_sync_diag' に残し、設定画面に表示する。
 * @param days 何日分遡って取るか(初回は90日、通常は14日で十分)
 */
export async function syncOura(days = 14): Promise<{ synced: number } | null> {
  const token = await getOuraToken();
  if (!token) return null;
  const end = toKey(new Date());
  const start = toKey(addDays(new Date(), -days));

  const rows: MetricRow[] = [];
  const diag: OuraDiag = { at: new Date().toISOString(), readiness: '', sleep: '', activity: '' };
  let failures = 0;
  let badToken = false;
  const noteError = (e: unknown): string => {
    failures++;
    if (e instanceof Error && e.message === 'OURA_BAD_TOKEN') badToken = true;
    return errLabel(e);
  };

  try {
    const readiness = await fetchAll<OuraReadiness>(token, 'daily_readiness', start, end);
    let n = 0;
    for (const r of readiness) {
      if (r.score != null) { rows.push({ date: r.day, metric: 'oura_readiness', value: r.score }); n++; }
      if (r.temperature_deviation != null) rows.push({ date: r.day, metric: 'temp_deviation', value: r.temperature_deviation });
    }
    diag.readiness = `${n}件`;
  } catch (e) { diag.readiness = noteError(e); }

  try {
    const sleep = await fetchAll<OuraDaily>(token, 'daily_sleep', start, end);
    let n = 0;
    for (const s of sleep) if (s.score != null) { rows.push({ date: s.day, metric: 'oura_sleep_score', value: s.score }); n++; }
    diag.sleep = `${n}件`;
  } catch (e) { diag.sleep = noteError(e); }

  try {
    const activity = await fetchAll<OuraDaily>(token, 'daily_activity', start, end);
    let n = 0;
    for (const a of activity) if (a.score != null) { rows.push({ date: a.day, metric: 'oura_activity_score', value: a.score }); n++; }
    // 取得はできたがスコアが入っていない(未確定等)ケースも切り分けられるようにする
    diag.activity = activity.length > 0 && n === 0 ? `0件(取得${activity.length}件・スコア未確定)` : `${n}件`;
  } catch (e) { diag.activity = noteError(e); }

  await kvSet('oura_sync_diag', JSON.stringify(diag)).catch(() => {});
  await upsertMetrics(rows);
  if (failures === 3) throw new Error(badToken ? 'OURA_BAD_TOKEN' : 'OURA_ALL_FAILED');
  return { synced: rows.length };
}
