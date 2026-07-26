export type GoalCategory = 'short' | 'mid' | 'long' | 'life';

export interface Goal {
  id: number;
  title: string;
  category: GoalCategory;
  deadline: string | null; // YYYY-MM-DD
  sort_order: number;
  created_at: string;
  archived: number; // 0 | 1
}

export interface Affirmation {
  id: number;
  text: string;
  tag: string | null;
  goal_id: number | null;
  voice_uri: string | null; // Phase 2
  sort_order: number;
  active: number; // 0 | 1
}

export interface Principle {
  id: number;
  source: string | null;
  text: string;
  is_preset: number; // 0 | 1
  active: number; // 0 | 1
}

export interface RitualDay {
  date: string; // YYYY-MM-DD (PK)
  declared: number; // 0 | 1
  principle: number; // 0 | 1
  journal: number; // 0 | 1
  completed_at: string | null;
}

export interface JournalEntry {
  date: string; // YYYY-MM-DD (PK)
  gratitude: string;
  progress: string;
  vision: string;
}

/** settings テーブルの既知キー */
export type SettingKey =
  | 'identity'
  | 'mvv_mission'
  | 'mvv_vision'
  | 'mvv_value'
  | 'notify_morning' // "HH:MM"
  | 'notify_evening_enabled' // "1" | "0"
  | 'onboarding_done' // "1"
  | 'ai_endpoint'; // Edge Function URLの上書き(通常はビルド時env)

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, { en: string; jp: string }> = {
  short: { en: 'SHORT', jp: '短期' },
  mid: { en: 'MID', jp: '中期' },
  long: { en: 'LONG', jp: '長期' },
  life: { en: 'LIFE', jp: '人生' },
};

export const GOAL_CATEGORIES: GoalCategory[] = ['short', 'mid', 'long', 'life'];
