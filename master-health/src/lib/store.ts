/**
 * v2 ドメインストア (expo-sqlite)
 * 食事・トレーニング・DayType・プロファイル・チャット履歴の永続化。
 *
 * 設計:
 * - 小さな設定ドキュメント(プロファイル・DayType定義)は kv にJSONで保存
 *   (項目の追加変更が多く、リレーショナルにする利益が薄いため)
 * - ログ類(食事・トレ)と食材マスタ・テンプレートはテーブルで保存
 *   (期間集計・検索が必要なため)
 * - タイムスタンプはすべてISO 8601。表示時にローカルTZへ変換する
 */
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('master-health.db');

db.execAsync(`
  CREATE TABLE IF NOT EXISTS ingredient_master (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    kcal_per_unit REAL NOT NULL,
    protein_per_unit REAL NOT NULL,
    fat_per_unit REAL NOT NULL,
    carbs_per_unit REAL NOT NULL,
    dietary_tags TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS food_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    items TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS meal_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    template_id TEXT,
    free_text TEXT,
    kcal REAL NOT NULL,
    protein REAL NOT NULL,
    fat REAL NOT NULL,
    carbs REAL NOT NULL,
    is_estimate INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_meal_ts ON meal_logs(timestamp);
  CREATE TABLE IF NOT EXISTS workout_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    exercises TEXT NOT NULL DEFAULT '[]',
    duration_min REAL,
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_workout_ts ON workout_logs(timestamp);
  CREATE TABLE IF NOT EXISTS day_assignments (
    date TEXT PRIMARY KEY,
    day_type_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS workout_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    exercises TEXT NOT NULL DEFAULT '[]',
    duration_min REAL
  );
  CREATE TABLE IF NOT EXISTS stress_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    level INTEGER NOT NULL,
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_stress_ts ON stress_logs(timestamp);
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
  .then(() => normalizeLogTimestamps())
  .catch((e) => console.warn('store init failed', e));

/**
 * 一度だけ、ログのタイムスタンプをUTCのISO文字列(toISOString)に揃える。
 * チャット経由の記録でタイムゾーン記号なしのローカル時刻文字列が混在すると、
 * BETWEENの文字列比較で範囲から漏れて「記録したのに反映されない」事故になるため。
 */
async function normalizeLogTimestamps(): Promise<void> {
  const FLAG = 'ts_normalize_v37';
  const done = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', FLAG).catch(() => null);
  if (done) return;
  for (const table of ['meal_logs', 'workout_logs', 'stress_logs']) {
    try {
      const rows = await db.getAllAsync<{ id: string; timestamp: string }>(`SELECT id, timestamp FROM ${table}`);
      for (const r of rows) {
        const d = new Date(r.timestamp);
        if (isNaN(d.getTime())) continue;
        const iso = d.toISOString();
        if (iso !== r.timestamp) await db.runAsync(`UPDATE ${table} SET timestamp = ? WHERE id = ?`, iso, r.id);
      }
    } catch { /* テーブル単位で失敗しても他を続ける */ }
  }
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', FLAG, 'done').catch(() => {});
}

// ---- 型 (instructions v2 準拠) ----

export interface Goal {
  id: string;
  metric: 'body_fat_pct' | 'weight' | 'muscle_pct' | 'steps' | 'custom';
  label?: string;
  targetValue: number;
  deadline: string;
  minimumAcceptable?: number;
}

export interface DietaryFlag {
  ingredient: string;
  severity: 'avoid' | 'moderate' | 'watch';
  note?: string;
}

export interface Supplement { name: string; timing?: string }

export interface UserProfile {
  heightCm: number | null;
  birthDate: string | null;
  sex: 'male' | 'female';
  goals: Goal[];
  dietaryFlags: DietaryFlag[];
  supplements: Supplement[];
}

export const DEFAULT_PROFILE: UserProfile = {
  heightCm: null,
  birthDate: null,
  sex: 'male',
  goals: [],
  dietaryFlags: [],
  supplements: [],
};

export interface MealSlot { name: string; hint?: string }

export interface DayTypeDef {
  id: string;
  name: string;
  mealPlan: MealSlot[];
  colorTag: string;
}

export const DEFAULT_DAY_TYPES: DayTypeDef[] = [
  { id: 'normal', name: '通常日', mealPlan: [], colorTag: '#85BFA4' },
];

export interface IngredientMaster {
  id: string;
  name: string;
  unit: string;
  kcalPerUnit: number;
  proteinPerUnit: number;
  fatPerUnit: number;
  carbsPerUnit: number;
  dietaryTags: string[];
}

export interface FoodTemplate {
  id: string;
  name: string;
  aliases: string[];
  items: { ingredientId: string; quantity: number }[];
}

export interface MealLog {
  id: string;
  timestamp: string;
  templateId?: string | null;
  freeText?: string | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  isEstimate: boolean;
}

export interface ExerciseSet {
  exerciseName: string;
  weight?: number;
  weightUnit?: 'lb' | 'kg';
  reps: number;
  sets: number;
}

export interface WorkoutLog {
  id: string;
  timestamp: string;
  exercises: ExerciseSet[];
  durationMin?: number | null;
  note?: string | null;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---- kvドキュメント (profile / dayTypes) ----

async function kvDoc<T>(key: string, fallback: T): Promise<T> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

async function kvPut(key: string, value: unknown): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}

export const getProfile = () => kvDoc<UserProfile>('user_profile', DEFAULT_PROFILE);
export const saveProfile = (p: UserProfile) => kvPut('user_profile', p);

export const getDayTypes = () => kvDoc<DayTypeDef[]>('day_types', DEFAULT_DAY_TYPES);
export const saveDayTypes = (d: DayTypeDef[]) => kvPut('day_types', d);

// ---- 目標プラン(カロミル風の目標設定) ----

export interface GoalPlan {
  /** どちらの指標を重視するか(デフォルト: 体脂肪率) */
  priority: 'body_fat' | 'weight';
  /** 目標体脂肪率(%)。nullなら未設定 */
  targetBodyFatPct: number | null;
  /** 目標体重(kg)。nullなら未設定 */
  targetWeightKg: number | null;
  /** 目標日 YYYY-MM-DD */
  targetDate: string | null;
  /** 目標設定時の体重・日付(進捗と累積赤字の起点) */
  startWeightKg: number | null;
  startDate: string | null;
  /** 摂取カロリー目標: auto=目標ペースから逆算 / custom=手入力 */
  intakeMode: 'auto' | 'custom';
  customIntakeKcal: number | null;
  /** PFCバランス(%)。合計100 */
  pfc: { p: number; f: number; c: number };
}

export const DEFAULT_GOAL_PLAN: GoalPlan = {
  priority: 'body_fat',
  targetBodyFatPct: null,
  targetWeightKg: null,
  targetDate: null,
  startWeightKg: null,
  startDate: null,
  intakeMode: 'auto',
  customIntakeKcal: null,
  pfc: { p: 30, f: 25, c: 45 },
};

/** 旧バージョンで保存したプランに新フィールドを補完して返す */
export const getGoalPlan = async (): Promise<GoalPlan> => ({
  ...DEFAULT_GOAL_PLAN,
  ...(await kvDoc<Partial<GoalPlan>>('goal_plan', {})),
});
export const saveGoalPlan = (g: GoalPlan) => kvPut('goal_plan', g);

// ---- DayType割り当て ----

export async function setDayAssignment(date: string, dayTypeId: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO day_assignments (date, day_type_id) VALUES (?, ?)', date, dayTypeId);
}

export async function getDayAssignment(date: string): Promise<string> {
  const row = await db.getFirstAsync<{ day_type_id: string }>(
    'SELECT day_type_id FROM day_assignments WHERE date = ?', date,
  );
  return row?.day_type_id ?? 'normal';
}

// ---- 食材マスタ ----

export async function listIngredients(): Promise<IngredientMaster[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM ingredient_master ORDER BY name');
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    unit: r.unit as string,
    kcalPerUnit: r.kcal_per_unit as number,
    proteinPerUnit: r.protein_per_unit as number,
    fatPerUnit: r.fat_per_unit as number,
    carbsPerUnit: r.carbs_per_unit as number,
    dietaryTags: JSON.parse((r.dietary_tags as string) || '[]'),
  }));
}

export async function upsertIngredient(ing: IngredientMaster): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO ingredient_master
     (id, name, unit, kcal_per_unit, protein_per_unit, fat_per_unit, carbs_per_unit, dietary_tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ing.id, ing.name, ing.unit, ing.kcalPerUnit, ing.proteinPerUnit, ing.fatPerUnit, ing.carbsPerUnit,
    JSON.stringify(ing.dietaryTags),
  );
}

export async function deleteIngredient(id: string): Promise<void> {
  await db.runAsync('DELETE FROM ingredient_master WHERE id = ?', id);
}

// ---- 食事テンプレート ----

export async function listTemplates(): Promise<FoodTemplate[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; aliases: string; items: string }>(
    'SELECT * FROM food_templates ORDER BY name',
  );
  return rows.map((r) => ({
    id: r.id, name: r.name,
    aliases: JSON.parse(r.aliases || '[]'),
    items: JSON.parse(r.items || '[]'),
  }));
}

/** テンプレートの登録上限(食事・運動それぞれ) */
export const TEMPLATE_LIMIT = 30;

export async function upsertTemplate(t: FoodTemplate): Promise<void> {
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM food_templates WHERE id = ?', t.id);
  if (!existing) {
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM food_templates');
    if ((row?.n ?? 0) >= TEMPLATE_LIMIT) throw new Error('TEMPLATE_LIMIT');
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO food_templates (id, name, aliases, items) VALUES (?, ?, ?, ?)',
    t.id, t.name, JSON.stringify(t.aliases), JSON.stringify(t.items),
  );
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.runAsync('DELETE FROM food_templates WHERE id = ?', id);
}

/** テンプレートのPFCを食材マスタから計算 */
export async function templateNutrition(t: FoodTemplate): Promise<{ kcal: number; protein: number; fat: number; carbs: number }> {
  const ings = await listIngredients();
  const byId = new Map(ings.map((i) => [i.id, i]));
  let kcal = 0, protein = 0, fat = 0, carbs = 0;
  for (const item of t.items) {
    const ing = byId.get(item.ingredientId);
    if (!ing) continue;
    kcal += ing.kcalPerUnit * item.quantity;
    protein += ing.proteinPerUnit * item.quantity;
    fat += ing.fatPerUnit * item.quantity;
    carbs += ing.carbsPerUnit * item.quantity;
  }
  return { kcal: Math.round(kcal), protein: round1(protein), fat: round1(fat), carbs: round1(carbs) };
}

// ---- 運動テンプレート ----

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: ExerciseSet[];
  durationMin?: number | null;
}

export async function listWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; exercises: string; duration_min: number | null }>(
    'SELECT * FROM workout_templates ORDER BY name',
  );
  return rows.map((r) => ({
    id: r.id, name: r.name,
    exercises: JSON.parse(r.exercises || '[]'),
    durationMin: r.duration_min,
  }));
}

export async function upsertWorkoutTemplate(t: WorkoutTemplate): Promise<void> {
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM workout_templates WHERE id = ?', t.id);
  if (!existing) {
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM workout_templates');
    if ((row?.n ?? 0) >= TEMPLATE_LIMIT) throw new Error('TEMPLATE_LIMIT');
  }
  await db.runAsync(
    'INSERT OR REPLACE INTO workout_templates (id, name, exercises, duration_min) VALUES (?, ?, ?, ?)',
    t.id, t.name, JSON.stringify(t.exercises), t.durationMin ?? null,
  );
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', id);
}

// ---- 食事ログ ----

export async function addMealLog(log: MealLog): Promise<void> {
  await db.runAsync(
    `INSERT INTO meal_logs (id, timestamp, template_id, free_text, kcal, protein, fat, carbs, is_estimate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    log.id, log.timestamp, log.templateId ?? null, log.freeText ?? null,
    log.kcal, log.protein, log.fat, log.carbs, log.isEstimate ? 1 : 0,
  );
}

export async function deleteMealLog(id: string): Promise<void> {
  await db.runAsync('DELETE FROM meal_logs WHERE id = ?', id);
}

export async function listMealLogs(fromIso: string, toIso: string): Promise<MealLog[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM meal_logs WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC',
    fromIso, toIso,
  );
  return rows.map(rowToMeal);
}

function rowToMeal(r: Record<string, unknown>): MealLog {
  return {
    id: r.id as string,
    timestamp: r.timestamp as string,
    templateId: r.template_id as string | null,
    freeText: r.free_text as string | null,
    kcal: r.kcal as number,
    protein: r.protein as number,
    fat: r.fat as number,
    carbs: r.carbs as number,
    isEstimate: (r.is_estimate as number) === 1,
  };
}

/** 日別の摂取合計(ローカルTZの日付キーで集計) */
export async function dailyIntake(fromIso: string, toIso: string): Promise<Map<string, { kcal: number; protein: number; fat: number; carbs: number }>> {
  const logs = await listMealLogs(fromIso, toIso);
  const map = new Map<string, { kcal: number; protein: number; fat: number; carbs: number }>();
  for (const l of logs) {
    const key = localDateKey(l.timestamp);
    const d = map.get(key) ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    d.kcal += l.kcal; d.protein += l.protein; d.fat += l.fat; d.carbs += l.carbs;
    map.set(key, d);
  }
  return map;
}

// ---- トレーニングログ ----

export async function addWorkoutLog(log: WorkoutLog): Promise<void> {
  await db.runAsync(
    'INSERT INTO workout_logs (id, timestamp, exercises, duration_min, note) VALUES (?, ?, ?, ?, ?)',
    log.id, log.timestamp, JSON.stringify(log.exercises), log.durationMin ?? null, log.note ?? null,
  );
}

export async function deleteWorkoutLog(id: string): Promise<void> {
  await db.runAsync('DELETE FROM workout_logs WHERE id = ?', id);
}

export async function listWorkoutLogs(fromIso: string, toIso: string): Promise<WorkoutLog[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM workout_logs WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC',
    fromIso, toIso,
  );
  return rows.map((r) => ({
    id: r.id as string,
    timestamp: r.timestamp as string,
    exercises: JSON.parse((r.exercises as string) || '[]'),
    durationMin: r.duration_min as number | null,
    note: r.note as string | null,
  }));
}

/** 同一種目の直近実績(前回比較用) */
export async function lastExercise(exerciseName: string): Promise<{ timestamp: string; set: ExerciseSet } | null> {
  const rows = await db.getAllAsync<{ timestamp: string; exercises: string }>(
    'SELECT timestamp, exercises FROM workout_logs ORDER BY timestamp DESC LIMIT 50',
  );
  const norm = exerciseName.trim().toLowerCase();
  for (const r of rows) {
    const sets: ExerciseSet[] = JSON.parse(r.exercises || '[]');
    const hit = sets.find((s) => s.exerciseName.trim().toLowerCase() === norm);
    if (hit) return { timestamp: r.timestamp, set: hit };
  }
  return null;
}

// ---- ストレスログ ----

export interface StressLog {
  id: string;
  timestamp: string;
  /** 1=快調 〜 5=限界 */
  level: number;
  note?: string | null;
}

export async function addStressLog(log: StressLog): Promise<void> {
  await db.runAsync(
    'INSERT INTO stress_logs (id, timestamp, level, note) VALUES (?, ?, ?, ?)',
    log.id, log.timestamp, log.level, log.note ?? null,
  );
}

export async function deleteStressLog(id: string): Promise<void> {
  await db.runAsync('DELETE FROM stress_logs WHERE id = ?', id);
}

export async function listStressLogs(fromIso: string, toIso: string): Promise<StressLog[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM stress_logs WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC',
    fromIso, toIso,
  );
  return rows.map((r) => ({
    id: r.id as string,
    timestamp: r.timestamp as string,
    level: r.level as number,
    note: r.note as string | null,
  }));
}

// ---- チャット履歴 ----

export async function appendChat(role: 'user' | 'assistant', content: string): Promise<void> {
  await db.runAsync('INSERT INTO chat_messages (role, content) VALUES (?, ?)', role, content);
}

export async function listChat(limit = 100): Promise<ChatMessage[]> {
  const rows = await db.getAllAsync<ChatMessage>(
    'SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?', limit,
  );
  return rows.reverse();
}

export async function clearChat(): Promise<void> {
  await db.runAsync('DELETE FROM chat_messages');
}

export async function chatCount(): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM chat_messages');
  return row?.n ?? 0;
}

/** 古い順にlimit件(履歴の要約・圧縮用) */
export async function oldestChat(limit: number): Promise<ChatMessage[]> {
  return db.getAllAsync<ChatMessage>('SELECT * FROM chat_messages ORDER BY id ASC LIMIT ?', limit);
}

export async function deleteChatUpTo(maxId: number): Promise<void> {
  await db.runAsync('DELETE FROM chat_messages WHERE id <= ?', maxId);
}

// ---- 会話メモリ(長期記憶) ----

export type MemoryCategory = 'preference' | 'decision' | 'context' | 'issue';

export interface Memory {
  id: string;
  category: MemoryCategory;
  content: string;
  createdAt: string;
}

const MEMORY_LIMIT = 100;

export async function listMemories(): Promise<Memory[]> {
  const rows = await db.getAllAsync<{ id: string; category: string; content: string; created_at: string }>(
    'SELECT * FROM memories ORDER BY created_at ASC',
  );
  return rows.map((r) => ({
    id: r.id,
    category: (['preference', 'decision', 'context', 'issue'].includes(r.category) ? r.category : 'context') as MemoryCategory,
    content: r.content,
    createdAt: r.created_at,
  }));
}

export async function addMemory(category: MemoryCategory, content: string): Promise<string> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM memories');
  if ((row?.n ?? 0) >= MEMORY_LIMIT) throw new Error('MEMORY_LIMIT');
  const id = newId();
  await db.runAsync('INSERT INTO memories (id, category, content) VALUES (?, ?, ?)', id, category, content);
  return id;
}

export async function deleteMemory(id: string): Promise<void> {
  await db.runAsync('DELETE FROM memories WHERE id = ?', id);
}

// ---- utils ----

function round1(x: number): number { return Math.round(x * 10) / 10 }

/** ISOタイムスタンプ → ローカルTZの日付キー(YYYY-MM-DD) */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
