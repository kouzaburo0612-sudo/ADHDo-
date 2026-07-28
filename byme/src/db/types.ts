// ---------- v3 コンテンツモデル ----------

/** すべての刷り込み対象の種別 */
export type ContentType = 'AFFIRMATION' | 'IMAGING' | 'GOAL' | 'NUMBER' | 'PRINCIPLE' | 'OPTIONAL';

export const CONTENT_TYPES: ContentType[] = [
  'AFFIRMATION',
  'IMAGING',
  'GOAL',
  'NUMBER',
  'PRINCIPLE',
  'OPTIONAL',
];

export type RitualMode = 'quick' | 'standard' | 'full';

/** 表示頻度。"daily" | "weekly:0,3,5"(曜日 0=日) | "monthly:1"(日付) | "rotation"(ローテーション枠のみ) */
export type CadenceString = string;

export type DuplicateStatus = 'candidate' | 'merged' | 'independent';

/**
 * content_items 行。type固有の属性は extra(JSON)に持つ。
 * modes は "quick,standard,full" のようなCSV。
 */
export interface ContentItem {
  id: number;
  type: ContentType;
  title: string;
  body: string;
  /** 1(低)〜3(最重要) */
  priority: number;
  is_active: number; // 0 | 1
  cadence: CadenceString;
  modes: string;
  /** 重点反復フラグ */
  emphasis: number; // 0 | 1
  sort_order: number;
  extra: string; // JSON
  created_at: string; // ISO
  updated_at: string; // ISO
  last_shown_at: string | null; // ISO
  show_count: number;
  archived_at: string | null; // ISO
  canonical_item_id: number | null;
  duplicate_status: DuplicateStatus | null;
}

export type GoalHorizon = 'SHORT' | 'MID' | 'LONG';

export interface GoalExtra {
  horizon: GoalHorizon;
  targetYear?: number;
  targetDate?: string;
  relatedNumberIds?: number[];
  relatedImagingIds?: number[];
  relatedAffirmationIds?: number[];
  relatedPrincipleIds?: number[];
}

export interface NumberExtra {
  unit: string;
  /** 正式目標(コミット) */
  officialTarget: number;
  /** 現在実績 */
  currentValue: number;
  /** 唱えるストレッチ数字。正式目標とは別フィールドで管理する */
  imagingTarget: number | null;
  targetYear?: number;
  deadline?: string; // YYYY-MM-DD
  linkedCondition?: string | null;
  relatedGoalId?: number;
  /** 現在値の最終更新日 */
  lastUpdatedAt?: string;
}

export interface ImagingExtra {
  tag?: string;
  numberText?: string;
  caption?: string;
  /** 背景グラデーション(画像がない場合のフォールバック) */
  gradient?: [string, string, string];
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  /** 五感ガイド(「何が見える?」等)。毎回入力は求めず表示のみ */
  sensoryGuide?: string[];
  targetYear?: number;
}

export type PrincipleRole = 'CORE' | 'ROTATING';

export interface PrincipleExtra {
  role: PrincipleRole;
  category?: string;
}

export interface OptionalExtra {
  group?: string; // 'BODY' | 'SLEEP' | 'QUEST' など
  category?: string;
  done?: boolean;
  note?: string;
}

// ---------- 儀式セッション ----------

export type SessionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface RitualSession {
  id: number;
  date: string; // YYYY-MM-DD
  mode: RitualMode;
  /** JSON: content_item id の配列(生成時に固定) */
  playlist: string;
  current_index: number;
  started_at: string; // ISO
  completed_at: string | null;
  elapsed_seconds: number;
  status: SessionStatus;
  /** 再開回数(中断→再開の記録) */
  resumed: number;
}

/** 統合ログ。統合しても元文章を保全し、復元可能にする */
export interface MergeLogRow {
  id: number;
  canonical_item_id: number;
  merged_item_id: number;
  merged_at: string;
  reason: string | null;
  original_title: string;
  original_body: string;
}

// ---------- settings ----------

export type SettingKey =
  | 'identity'
  | 'mvv_mission'
  | 'mvv_vision'
  | 'mvv_values_company'
  | 'theme_2026'
  | 'wake_time' // "HH:MM" 朝通知時刻
  | 'default_mode' // quick | standard | full
  | 'auto_advance' // "1" | "0"
  | 'seconds_per_screen' // 自動送りの秒数
  | 'tts_enabled' // 音声読み上げ
  | 'haptics_enabled'
  | 'aff_display' // full | split(1文ずつ)
  | 'notify_morning_enabled'
  | 'notify_noon_enabled'
  | 'notify_evening_enabled'
  | 'notify_night_enabled'
  | 'notify_days' // "0,1,2,3,4,5,6" 通知する曜日
  | 'noon_time' // "HH:MM"
  | 'evening_time'
  | 'night_time'
  | 'show_streak' // ストリーク表示
  | 'show_rate' // 実施率表示
  | 'image_dim' // 背景画像の暗さ 0〜1
  | 'font_scale' // 儀式画面の文字倍率
  | 'full_max_items' // FULLの最大件数
  // 旧キー(後方互換のため残置)
  | 'notify_kpi_enabled'
  | 'notify_extra_enabled'
  | 'notify_streak_enabled';

// ---------- 旧v2スキーマの行型(マイグレーション読み取り専用) ----------

export interface LegacyKpi {
  id: number;
  label: string;
  commit_value: number;
  stretch_value: number | null;
  current_value: number;
  unit: string;
  deadline: string;
  linked_condition: string | null;
  sort_order: number;
}

export interface LegacyPrinciple {
  id: number;
  category: string;
  text: string;
  active: number;
  sort_order: number;
}

export interface LegacyAffirmation {
  id: number;
  title: string;
  body: string;
  scene_tag: string | null;
  sort_order: number;
}

export interface LegacyScene {
  id: number;
  tag: string;
  number_text: string;
  caption: string;
  body: string;
  bg_gradient: string;
  sort_order: number;
}

export interface LegacyQuest {
  id: number;
  category: string;
  title: string;
  done: number;
  note: string | null;
}

export interface LegacyDailyLog {
  date: string;
  theater: number;
  principle: number;
  body_meditation: number;
  body_diet: number;
  body_training: number;
}

// ---------- ヘルパ ----------

export function parseExtra<T>(item: ContentItem): T {
  try {
    return JSON.parse(item.extra) as T;
  } catch {
    return {} as T;
  }
}

export function parseModes(item: ContentItem): RitualMode[] {
  return item.modes
    .split(',')
    .map((m) => m.trim())
    .filter((m): m is RitualMode => m === 'quick' || m === 'standard' || m === 'full');
}

export function parsePlaylist(session: RitualSession): number[] {
  try {
    const v = JSON.parse(session.playlist);
    return Array.isArray(v) ? v.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}
