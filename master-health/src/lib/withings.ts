/**
 * Withings API 直接連携(OAuth 2.0)
 * ==================================
 * HealthKitに流れてこないWithings独自データ(骨量・体水分・血圧・脈波伝播速度)を
 * Measure APIから直接取得してmetricsに保存する。
 *
 * フロー:
 * 1. startWithingsAuth() → Safariで認可 → Withingsがコールバック(Supabase Function)へ
 * 2. コールバックが vyta://withings-callback?code=... へリダイレクト
 * 3. _layoutのLinkingリスナーが completeWithingsAuth() を呼ぶ
 * 4. トークン交換・更新はSupabase Function経由(Client Secretは端末にもリポジトリにも置かない)
 */
import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';

import { kvGet, kvSet, upsertMetrics, type MetricRow } from '@/lib/db';
import { toKey } from '@/lib/dates';
import type { MetricKey } from '@/lib/metrics';

/** Client IDは認可URLに載る公開情報(Secretはサーバ側のみ) */
const CLIENT_ID = '0b4d273c5807d6a3846f3e7af5528b0ec3759ae4e40a4f76fb218c5802632446';
const CALLBACK_URL = 'https://wxqsvcsrbuidqqsmkqnx.supabase.co/functions/v1/withings-callback';
const TOKEN_FN_URL = 'https://wxqsvcsrbuidqqsmkqnx.supabase.co/functions/v1/withings-token';
const MEASURE_URL = 'https://wbsapi.withings.net/measure';

const K_ACCESS = 'withings_access_token';
const K_REFRESH = 'withings_refresh_token';
const K_EXPIRES = 'withings_expires_at';
const K_STATE = 'withings_oauth_state';

/** Withings meastype → VYTA metricキー(HealthKitと重複しないものだけ) */
const MEASTYPE_MAP: Record<number, MetricKey> = {
  9: 'bp_dia',      // 拡張期血圧 mmHg
  10: 'bp_sys',     // 収縮期血圧 mmHg
  77: 'body_water', // 体水分 kg
  88: 'bone_mass',  // 骨量 kg
  91: 'pwv',        // 脈波伝播速度 m/s(血管年齢の元指標)
};

export async function isWithingsConnected(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(K_REFRESH)) != null; } catch { return false; }
}

export async function disconnectWithings(): Promise<void> {
  await SecureStore.deleteItemAsync(K_ACCESS).catch(() => {});
  await SecureStore.deleteItemAsync(K_REFRESH).catch(() => {});
  await SecureStore.deleteItemAsync(K_EXPIRES).catch(() => {});
}

/** 認可画面をSafariで開く(戻りはディープリンクで_layoutが受ける) */
export async function startWithingsAuth(): Promise<void> {
  const state = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  await SecureStore.setItemAsync(K_STATE, state);
  const url = 'https://account.withings.com/oauth2_user/authorize2'
    + '?response_type=code'
    + `&client_id=${CLIENT_ID}`
    + '&scope=user.info,user.metrics,user.activity'
    + `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`
    + `&state=${state}`;
  await Linking.openURL(url);
}

interface TokenResponse {
  status: number;
  body?: { access_token?: string; refresh_token?: string; expires_in?: number };
  error?: string;
}

async function callTokenFn(payload: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`WITHINGS_FN_${res.status}`);
  return res.json();
}

async function saveTokens(body: NonNullable<TokenResponse['body']>): Promise<void> {
  if (!body.access_token || !body.refresh_token) throw new Error('WITHINGS_NO_TOKEN');
  await SecureStore.setItemAsync(K_ACCESS, body.access_token);
  await SecureStore.setItemAsync(K_REFRESH, body.refresh_token);
  await SecureStore.setItemAsync(K_EXPIRES, String(Date.now() + ((body.expires_in ?? 10800) - 120) * 1000));
}

/** ディープリンクで戻ってきた認可コードをトークンに交換し、初回同期する */
export async function completeWithingsAuth(code: string, state: string): Promise<{ synced: number }> {
  const saved = await SecureStore.getItemAsync(K_STATE);
  if (!code) throw new Error('WITHINGS_NO_CODE');
  if (saved != null && state !== saved) throw new Error('WITHINGS_BAD_STATE');
  const j = await callTokenFn({ action: 'exchange', code });
  if (j.status !== 0 || !j.body) throw new Error(`WITHINGS_EXCHANGE_${j.status}`);
  await saveTokens(j.body);
  await SecureStore.deleteItemAsync(K_STATE).catch(() => {});
  return (await syncWithings(365)) ?? { synced: 0 }; // 初回は1年分
}

async function getAccessToken(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync(K_REFRESH);
  if (!refresh) return null;
  const access = await SecureStore.getItemAsync(K_ACCESS);
  const exp = Number(await SecureStore.getItemAsync(K_EXPIRES)) || 0;
  if (access && Date.now() < exp) return access;
  const j = await callTokenFn({ action: 'refresh', refresh_token: refresh });
  if (j.status !== 0 || !j.body) throw new Error(`WITHINGS_REFRESH_${j.status}`);
  await saveTokens(j.body);
  return j.body.access_token!;
}

interface MeasureGroup {
  date: number; // epoch秒
  measures: { value: number; type: number; unit: number }[];
}

/**
 * Withings Measure APIから骨量・体水分・血圧・PWVを同期する。
 * 未連携ならnullを返す。日単位でその日の最後の値を採用。
 */
export async function syncWithings(days = 14): Promise<{ synced: number } | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
  const params = new URLSearchParams({
    action: 'getmeas',
    meastypes: Object.keys(MEASTYPE_MAP).join(','),
    category: '1',
    startdate: String(start),
    enddate: String(end),
  });
  const res = await fetch(MEASURE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`WITHINGS_API_${res.status}`);
  const j: { status: number; body?: { measuregrps?: MeasureGroup[] } } = await res.json();
  if (j.status !== 0) throw new Error(`WITHINGS_MEAS_${j.status}`);

  const grps = (j.body?.measuregrps ?? []).slice().sort((a, b) => a.date - b.date);
  const rows: MetricRow[] = [];
  for (const g of grps) {
    const date = toKey(new Date(g.date * 1000));
    for (const m of g.measures) {
      const key = MEASTYPE_MAP[m.type];
      if (!key) continue;
      rows.push({ date, metric: key, value: m.value * Math.pow(10, m.unit) });
    }
  }
  await upsertMetrics(rows);
  await kvSet('withings_last_sync', new Date().toISOString());
  return { synced: rows.length };
}

export async function withingsLastSync(): Promise<string | null> {
  return kvGet('withings_last_sync');
}
