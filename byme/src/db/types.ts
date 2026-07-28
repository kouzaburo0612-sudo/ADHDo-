export interface Kpi {
  id: number;
  label: string;
  commit_value: number;
  stretch_value: number | null;
  current_value: number;
  unit: string;
  deadline: string; // YYYY-MM-DD
  linked_condition: string | null;
  sort_order: number;
}

export interface Principle {
  id: number;
  category: string;
  text: string;
  active: number; // 0 | 1
  sort_order: number;
}

export interface Affirmation {
  id: number;
  title: string;
  body: string;
  scene_tag: string | null;
  sort_order: number;
}

export interface Scene {
  id: number;
  tag: string;
  number_text: string;
  caption: string;
  body: string;
  bg_gradient: string; // "色,色,色"
  sort_order: number;
}

export interface Quest {
  id: number;
  category: string;
  title: string;
  done: number; // 0 | 1
  note: string | null;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD (PK)
  theater: number;
  principle: number;
  body_meditation: number;
  body_diet: number;
  body_training: number;
}

export type DailyLogField = Exclude<keyof DailyLog, 'date'>;

/** 日次読了記録の対象種別 */
export type ReadKind = 'principle' | 'affirmation';

export interface ReadRecord {
  date: string;
  kind: ReadKind;
  item_id: number;
}

/** settings テーブルの既知キー */
export type SettingKey =
  | 'identity'
  | 'mvv_mission'
  | 'mvv_vision'
  | 'mvv_values_company'
  | 'theme_2026'
  | 'wake_time' // "HH:MM"(起床時刻=朝通知時刻。恒久ルール)
  | 'notify_kpi_enabled'; // "1" | "0"(日曜のKPI更新催促)
