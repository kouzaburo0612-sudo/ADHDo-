/**
 * チーム機能 (Supabase)
 * =====================
 * スタッフ・役員同士で日々の健康状態を相互に見られるようにする。
 *
 * - 認証: 匿名サインイン(端末=1メンバー)。セッションはAsyncStorageに永続化
 * - チーム: 招待コード(6桁)で作成・参加(RPC: create_team / join_team)
 * - 共有: 各自が「日次スナップショット」をアップロードする。
 *   共有ON/OFFは項目ごとに本人が選び、OFFの項目はそもそも送信しない
 * - 読み取りはRLSで「同じチームのメンバーのみ」に制限されている
 *
 * publishableキーはクライアント配布前提の公開鍵(データ保護はRLS側で担保)。
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getRange } from '@/lib/db';
import { addDays, toKey } from '@/lib/dates';
import { listStressLogs } from '@/lib/store';
import { balanceSeries } from '@/utils/deficit';
import { mean } from '@/utils/stats';

const SUPABASE_URL = 'https://wxqsvcsrbuidqqsmkqnx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PlHDORnxFJVM1b9LftaUBA_4SYa_jmq';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** 匿名サインイン(初回のみ。以後はセッション再利用) */
export async function ensureSignedIn(): Promise<string> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error || !anon.user) throw new Error(`AUTH_FAILED: ${error?.message ?? 'no user'}`);
  return anon.user.id;
}

// ---- 型 ----

export interface ShareSettings {
  weight: boolean;
  sleep: boolean;
  stress: boolean;
  activity: boolean;
  balance: boolean;
}

export const DEFAULT_SHARE: ShareSettings = {
  weight: true, sleep: true, stress: true, activity: true, balance: true,
};

export interface SnapshotPayload {
  /** 直近体重と7日前比(kg) */
  weightKg?: number;
  weightDelta7d?: number;
  /** 睡眠: 昨晩(分)と7日平均(分) */
  sleepLastMin?: number;
  sleepAvg7Min?: number;
  /** ストレス: 直近報告レベル(1-5) */
  stressLevel?: number;
  /** 活動: 歩数7日平均 */
  stepsAvg7?: number;
  /** 収支: 直近7日の赤字合計(正=燃焼) */
  deficit7d?: number;
  /** 注意フラグ */
  flags: string[];
}

export interface TeamMember {
  id: string;
  displayName: string;
  emoji: string;
  isMe: boolean;
  updatedAt: string | null;
  payload: SnapshotPayload | null;
}

export interface TeamState {
  joined: boolean;
  teamName?: string;
  inviteCode?: string;
  share?: ShareSettings;
  members?: TeamMember[];
}

// ---- チーム操作 ----

export async function createTeam(teamName: string, displayName: string, emoji: string): Promise<string> {
  await ensureSignedIn();
  const { data, error } = await supabase().rpc('create_team', {
    p_name: teamName, p_display_name: displayName, p_emoji: emoji,
  });
  if (error) throw new Error(error.message);
  return String(data); // 招待コード
}

export async function joinTeam(code: string, displayName: string, emoji: string): Promise<void> {
  await ensureSignedIn();
  const { error } = await supabase().rpc('join_team', {
    p_code: code, p_display_name: displayName, p_emoji: emoji,
  });
  if (error) {
    if (error.message.includes('INVALID_CODE')) throw new Error('INVALID_CODE');
    throw new Error(error.message);
  }
}

export async function leaveTeam(): Promise<void> {
  await ensureSignedIn();
  const { error } = await supabase().rpc('leave_team');
  if (error) throw new Error(error.message);
}

export async function updateShare(share: ShareSettings): Promise<void> {
  const uid = await ensureSignedIn();
  const { error } = await supabase().from('members')
    .update({ share, updated_at: new Date().toISOString() })
    .eq('id', uid);
  if (error) throw new Error(error.message);
}

/** チーム全体の状態(自分の所属・メンバー・最新スナップショット)を取得 */
export async function fetchTeam(): Promise<TeamState> {
  const uid = await ensureSignedIn();
  const sb = supabase();

  const { data: me } = await sb.from('members').select('*').eq('id', uid).maybeSingle();
  if (!me) return { joined: false };

  const [{ data: team }, { data: members }] = await Promise.all([
    sb.from('teams').select('*').eq('id', me.team_id).maybeSingle(),
    sb.from('members').select('*').eq('team_id', me.team_id),
  ]);

  // 直近3日分のスナップショットから、各メンバーの最新を1件選ぶ
  const from = toKey(addDays(new Date(), -3));
  const { data: snaps } = await sb.from('snapshots').select('*').gte('date', from);
  const latest = new Map<string, { date: string; payload: SnapshotPayload; updated_at: string }>();
  for (const s of snaps ?? []) {
    const cur = latest.get(s.member_id);
    if (!cur || s.date > cur.date) latest.set(s.member_id, s);
  }

  return {
    joined: true,
    teamName: team?.name,
    inviteCode: team?.invite_code,
    share: { ...DEFAULT_SHARE, ...(me.share ?? {}) },
    members: (members ?? [])
      .map((m) => ({
        id: m.id,
        displayName: m.display_name,
        emoji: m.emoji ?? '💪',
        isMe: m.id === uid,
        updatedAt: latest.get(m.id)?.updated_at ?? null,
        payload: latest.get(m.id)?.payload ?? null,
      }))
      .sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : a.displayName.localeCompare(b.displayName))),
  };
}

// ---- スナップショット送信 ----

/** ローカルデータから今日のスナップショットを作る(共有OFFの項目は含めない) */
export async function buildSnapshot(share: ShareSettings): Promise<SnapshotPayload> {
  const today = new Date();
  const range = await getRange(toKey(addDays(today, -14)), toKey(today));

  const series = (key: 'weight' | 'sleep_total' | 'steps', days: number): number[] => {
    const out: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const v = range.get(toKey(addDays(today, -i)))?.[key];
      if (v != null) out.push(v);
    }
    return out;
  };

  const p: SnapshotPayload = { flags: [] };

  if (share.weight) {
    const weights = series('weight', 14);
    if (weights.length > 0) {
      p.weightKg = Math.round(weights[weights.length - 1] * 10) / 10;
      const old = series('weight', 14).slice(0, Math.max(1, weights.length - 7));
      if (old.length > 0) {
        p.weightDelta7d = Math.round((p.weightKg - old[old.length - 1]) * 10) / 10;
        if (p.weightDelta7d >= 0.5) p.flags.push('weight_up');
      }
    }
  }

  if (share.sleep) {
    const sleeps = series('sleep_total', 7);
    if (sleeps.length > 0) {
      p.sleepLastMin = Math.round(sleeps[sleeps.length - 1]);
      p.sleepAvg7Min = Math.round(mean(sleeps) ?? 0);
      if (p.sleepAvg7Min < 360) p.flags.push('sleep_short');
    }
  }

  if (share.stress) {
    const from = addDays(today, -2);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const logs = await listStressLogs(from.toISOString(), end.toISOString());
    if (logs.length > 0) {
      p.stressLevel = Math.max(...logs.map((l) => l.level));
      if (p.stressLevel >= 4) p.flags.push('stress_high');
    }
  }

  if (share.activity) {
    const steps = series('steps', 7);
    if (steps.length > 0) {
      p.stepsAvg7 = Math.round(mean(steps) ?? 0);
      if (p.stepsAvg7 < 5000) p.flags.push('low_activity');
    }
  }

  if (share.balance) {
    const bal = await balanceSeries(7);
    const deficits = bal.map((b) => b.balance).filter((v): v is number => v != null);
    if (deficits.length > 0) {
      p.deficit7d = Math.round(-deficits.reduce((a, b) => a + b, 0));
    }
  }

  return p;
}

/** 今日のスナップショットをアップロード(チーム未参加なら何もしない) */
export async function pushSnapshot(): Promise<boolean> {
  try {
    const uid = await ensureSignedIn();
    const sb = supabase();
    const { data: me } = await sb.from('members').select('share').eq('id', uid).maybeSingle();
    if (!me) return false;
    const share = { ...DEFAULT_SHARE, ...(me.share ?? {}) };
    const payload = await buildSnapshot(share);
    const { error } = await sb.from('snapshots').upsert({
      member_id: uid,
      date: toKey(new Date()),
      payload,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

// ---- 表示ヘルパー ----

export const FLAG_LABELS: Record<string, string> = {
  weight_up: '📈 体重増加ぎみ',
  sleep_short: '😴 寝不足',
  stress_high: '🧠 ストレス高め',
  low_activity: '🚶 運動不足',
};
