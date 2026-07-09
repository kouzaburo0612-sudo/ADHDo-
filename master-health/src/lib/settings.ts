/** 目標値・スコア重み・APIキーの管理 */
import * as SecureStore from 'expo-secure-store';

import { kvGet, kvSet } from '@/lib/db';

export interface ScoreWeights {
  sleep: number;
  recovery: number;
  body: number;
  activity: number;
}

export interface Settings {
  /** 体脂肪率の目標(%) */
  bodyFatGoal: number;
  /** 体重の目標(kg)。未設定可 */
  weightGoal: number | null;
  /** 睡眠時間の目標(分) */
  sleepGoalMin: number;
  /** 歩数の目標 */
  stepsGoal: number;
  /** 総合スコアの重み(合計は自動で正規化) */
  weights: ScoreWeights;
}

export const DEFAULT_SETTINGS: Settings = {
  bodyFatGoal: 14.9,
  weightGoal: null,
  sleepGoalMin: 450, // 7.5時間
  stepsGoal: 8000,
  weights: { sleep: 0.3, recovery: 0.3, body: 0.2, activity: 0.2 },
};

const KEY = 'settings_v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await kvGet(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await kvSet(KEY, JSON.stringify(s));
}

// ---- Anthropic APIキー ----
// 優先順: SecureStore(設定画面から入力) > ビルド時環境変数
const API_KEY_STORE = 'anthropic_api_key';

export async function getApiKey(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(API_KEY_STORE);
    if (stored) return stored;
  } catch {
    // SecureStore不可の環境では環境変数のみ
  }
  return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? null;
}

export async function setApiKey(key: string): Promise<void> {
  if (key.trim() === '') {
    await SecureStore.deleteItemAsync(API_KEY_STORE);
  } else {
    await SecureStore.setItemAsync(API_KEY_STORE, key.trim());
  }
}
