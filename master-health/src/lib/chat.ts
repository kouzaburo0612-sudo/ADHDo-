/**
 * AIチャット基盤 (Anthropic Messages API + tool use)
 * ==================================================
 * - fetch直叩き(公式SDKはNode依存でRNでは使えない)
 * - 照会系ツール(query_*)はループ内で即実行して結果を返す
 * - 記録系ツール(log_* / set_day_type / add_template)は実行せずに
 *   PendingActionとしてUIへ返し、確認カードの承認後に resumeChat() で続行する
 *   (誤記録防止。instructions v2 §1.2)
 */
import { getRange, getSeries } from '@/lib/db';
import { addDays, toKey } from '@/lib/dates';
import { getApiKey, loadSettings, saveSettings } from '@/lib/settings';
import {
  addMealLog, addStressLog, addWorkoutLog, dailyIntake, deleteMealLog, deleteTemplate,
  deleteWorkoutTemplate, getDayAssignment, getDayTypes, getGoalPlan, getProfile,
  lastExercise, listTemplates, listWorkoutTemplates, localDateKey, newId, saveDayTypes,
  saveGoalPlan, saveProfile, setDayAssignment, templateNutrition, upsertIngredient,
  upsertTemplate, upsertWorkoutTemplate,
  type ExerciseSet, type FoodTemplate,
} from '@/lib/store';
import { computeBudget } from '@/utils/budget';
import { balanceSeries, calorieBank } from '@/utils/deficit';
import { planForecast } from '@/utils/forecast';
import { computeTdee, type TdeeInput } from '@/utils/tdee';
import { mean } from '@/utils/stats';

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TURNS = 6;

// ---- ツール定義 ----

const TOOLS = [
  {
    name: 'log_meal',
    description: '食事を記録する。テンプレート名が特定できればtemplate_nameを指定(PFCは自動計算)。自由入力の食事はkcal/protein/fat/carbsをあなたが概算してis_estimate=trueで渡す。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        datetime: { type: 'string', description: 'ISO 8601。省略時は現在時刻。「昨日の夜」等は具体時刻に変換する' },
        template_name: { type: 'string', description: '登録済みテンプレート名または別名' },
        free_text: { type: 'string', description: '自由入力の食事内容(テンプレートでない場合)' },
        kcal: { type: 'number' }, protein: { type: 'number' }, fat: { type: 'number' }, carbs: { type: 'number' },
        is_estimate: { type: 'boolean', description: 'AI概算ならtrue' },
      },
      required: [],
    },
  },
  {
    name: 'log_workout',
    description: 'トレーニングを記録する。登録済みテンプレート名(template_name)か種目リスト(exercises)のどちらかを渡す。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        datetime: { type: 'string' },
        template_name: { type: 'string', description: '登録済み運動テンプレート名(「いつものメニュー」等)' },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              exerciseName: { type: 'string' },
              weight: { type: 'number' },
              weightUnit: { type: 'string', enum: ['lb', 'kg'] },
              reps: { type: 'number' },
              sets: { type: 'number' },
            },
            required: ['exerciseName', 'reps', 'sets'],
          },
        },
        duration_min: { type: 'number' },
        note: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'set_day_type',
    description: '指定日のDayType(通常日/トレ日/会食日など)を設定する。存在しない名前なら新規作成される。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD。省略時は今日' },
        day_type_name: { type: 'string' },
      },
      required: ['day_type_name'],
    },
  },
  {
    name: 'add_template',
    description: '新しい食事テンプレートを登録する。食材ごとの単位あたりPFCも登録される。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        aliases: { type: 'array', items: { type: 'string' }, description: 'チャット認識用の別名(「いつもの」等)' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' }, unit: { type: 'string' }, quantity: { type: 'number' },
              kcal: { type: 'number', description: '1単位あたり' },
              protein: { type: 'number' }, fat: { type: 'number' }, carbs: { type: 'number' },
            },
            required: ['name', 'unit', 'quantity', 'kcal', 'protein', 'fat', 'carbs'],
          },
        },
      },
      required: ['name', 'items'],
    },
  },
  {
    name: 'set_goal',
    description: '期限つき目標(体脂肪率・体重など)を設定・更新する。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: ['body_fat_pct', 'weight', 'steps'] },
        target_value: { type: 'number' },
        deadline: { type: 'string', description: 'YYYY-MM-DD' },
        minimum_acceptable: { type: 'number', description: '最低ライン(任意)' },
      },
      required: ['metric', 'target_value', 'deadline'],
    },
  },
  {
    name: 'log_stress',
    description: 'ストレス・体調の主観報告を記録する。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        level: { type: 'number', description: '1=快調 2=ふつう 3=やや疲れ 4=つらい 5=限界' },
        note: { type: 'string' },
      },
      required: ['level'],
    },
  },
  {
    name: 'add_workout_template',
    description: 'トレーニングのテンプレートを登録する(上限30件)。「いつものメニュー」等を一発記録できるようになる。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              exerciseName: { type: 'string' },
              weight: { type: 'number' }, weightUnit: { type: 'string', enum: ['lb', 'kg'] },
              reps: { type: 'number' }, sets: { type: 'number' },
            },
            required: ['exerciseName', 'reps', 'sets'],
          },
        },
        duration_min: { type: 'number' },
      },
      required: ['name', 'exercises'],
    },
  },
  {
    name: 'delete_meal_log',
    description: '食事記録を1件削除する(誤記録の訂正用)。meal_idはquery_recentで確認する。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        meal_id: { type: 'string' },
        description: { type: 'string', description: '確認カードに出す説明(何を消すか)' },
      },
      required: ['meal_id'],
    },
  },
  {
    name: 'delete_template',
    description: '食事または運動のテンプレートを名前指定で削除する。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['food', 'workout'] },
        name: { type: 'string' },
      },
      required: ['kind', 'name'],
    },
  },
  {
    name: 'update_settings',
    description: 'アプリの設定を変更する。プロファイル(身長・生年月日・性別)、減量目標(重視指標・目標体脂肪率・目標体重・期日)、摂取カロリー目標、PFCバランス、スコア基準(睡眠・歩数・体脂肪率)に対応。変更したい項目だけ指定する。実行前にユーザー確認カードが表示される。',
    input_schema: {
      type: 'object',
      properties: {
        height_cm: { type: 'number' },
        birth_date: { type: 'string', description: 'YYYY-MM-DD' },
        sex: { type: 'string', enum: ['male', 'female'] },
        priority_metric: { type: 'string', enum: ['body_fat', 'weight'], description: '減量目標で重視する指標' },
        target_body_fat_pct: { type: 'number', description: '目標体脂肪率(%)' },
        target_weight_kg: { type: 'number', description: '目標体重(kg)' },
        target_date: { type: 'string', description: '目標期日 YYYY-MM-DD' },
        intake_mode: { type: 'string', enum: ['auto', 'custom'], description: '摂取目標の算出方法' },
        custom_intake_kcal: { type: 'number' },
        pfc_protein_pct: { type: 'number' }, pfc_fat_pct: { type: 'number' }, pfc_carbs_pct: { type: 'number' },
        sleep_goal_hours: { type: 'number', description: '睡眠スコアの目標時間' },
        steps_goal: { type: 'number', description: '活動スコアの目標歩数' },
        body_fat_score_goal_pct: { type: 'number', description: '体組成スコアの基準体脂肪率' },
      },
      required: [],
    },
  },
  {
    name: 'query_budget',
    description: '今週のカロリー収支(週予算・消費済み・残り・日割り推奨)を照会する。',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'query_body_trend',
    description: '体組成・歩数などの指標のトレンド(日次値と7日平均)を照会する。',
    input_schema: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: ['weight', 'body_fat', 'lean_mass', 'steps', 'sleep_total', 'hrv', 'rhr'] },
        days: { type: 'number', description: '直近何日分か。デフォルト30' },
      },
      required: ['metric'],
    },
  },
  {
    name: 'query_forecast',
    description: '目標(体脂肪率等)の達成予測(楽観/中央/悲観)を照会する。',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'query_recent',
    description: '直近の食事・トレーニング記録の一覧、および特定種目の前回実績を照会する。',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: '直近何日分か。デフォルト3' },
        exercise_name: { type: 'string', description: '指定すると同一種目の前回実績を返す' },
      },
      required: [],
    },
  },
] as const;

const MUTATION_TOOLS = new Set([
  'log_meal', 'log_workout', 'log_stress', 'set_day_type', 'add_template', 'add_workout_template',
  'delete_meal_log', 'delete_template', 'set_goal', 'update_settings',
]);

// ---- 型 ----

interface ApiMessage { role: 'user' | 'assistant'; content: unknown }

export interface PendingAction {
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  /** 確認カードに出す人間向けサマリー */
  summary: string;
  /** 承認後にループを再開するための会話状態 */
  messages: ApiMessage[];
}

export interface ChatTurnResult {
  text: string;
  pending: PendingAction | null;
}

// ---- システムプロンプト構築 (instructions v2 §4) ----

async function buildSystemPrompt(): Promise<string> {
  const profile = await getProfile();
  const dayTypes = await getDayTypes();
  const today = new Date();
  const todayKey = toKey(today);
  const dtId = await getDayAssignment(todayKey);
  const dt = dayTypes.find((d) => d.id === dtId);

  const from = addDays(today, -14);
  const intake = await dailyIntake(from.toISOString(), today.toISOString());
  const todayIntake = intake.get(localDateKey(today.toISOString())) ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 };

  const metricMap = await getRange(toKey(from), todayKey);
  const tdee = await currentTdee();
  const budget = tdee.effective != null
    ? computeBudget({
        tdee: tdee.effective, weekStart: 1, today,
        intakeByDate: new Map([...intake].map(([k, v]) => [k, v.kcal])),
        weeklyDeficitTarget: 0,
      })
    : null;

  const weights: number[] = [];
  for (const [, day] of metricMap) if (day.weight != null) weights.push(day.weight);
  const weightMa = mean(weights.slice(-7));

  const todayMeals = await (await import('@/lib/store')).listMealLogs(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(),
    today.toISOString(),
  );
  const mealLines = todayMeals.map((m) => {
    const t = new Date(m.timestamp);
    return `・${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} ${m.freeText ?? 'テンプレート食'} ${Math.round(m.kcal)}kcal`;
  }).join('\n') || '・(まだ記録なし)';

  const templates = await listTemplates();
  const workoutTemplates = await listWorkoutTemplates();
  const goals = profile.goals.map((g) => `${g.label ?? g.metric}: 目標${g.targetValue} 期限${g.deadline}`).join(' / ') || '未設定';
  const flags = profile.dietaryFlags.map((f) => `${f.ingredient}(${f.severity})`).join('、') || 'なし';

  // 今日の残り予算と累積赤字(ゲーム化の文脈)
  let balanceLine = '';
  try {
    const [bal] = (await balanceSeries(1)).slice(-1);
    const bank = await calorieBank();
    if (bal?.burn != null) {
      const remaining = bal.burn - (bal.intake ?? 0);
      balanceLine = `\n- 今日の${bal.provisional ? '暫定' : ''}TDEE(消費): ${bal.burn}kcal / 摂取: ${bal.intake ?? 0}kcal / 残り予算: ${remaining}kcal`;
    }
    balanceLine += `\n- カロリー赤字の累積: ${bank.bankedKcal}kcal(脂肪${bank.fatKgEquivalent}kg相当)、連続脂肪燃焼${bank.streakDays}日`;
  } catch { /* 補助情報 */ }

  // 今日のストレス報告
  let stressLine = '';
  try {
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const stress = await (await import('@/lib/store')).listStressLogs(dayStart.toISOString(), today.toISOString());
    if (stress.length > 0) {
      const labels = ['', '快調', 'ふつう', 'やや疲れ', 'つらい', '限界'];
      stressLine = `\n- 今日のストレス報告: ${stress.map((s) => `${labels[s.level] ?? s.level}${s.note ? `(${s.note})` : ''}`).join('、')}`;
    }
  } catch { /* 補助情報 */ }

  return `あなたは健康管理アプリVYTA(ヴァイタ)のHealth Manager AI「Mr. Vyta」。ユーザーの健康記録・照会・分析・アプリ設定の変更まで、すべてを日本語チャットで担当する専属マネージャー。

## 絶対ルール(違反は重大なバグとして扱われる)
- あなたはツールを呼ばない限り、記録も変更も一切できない。「記録します」「記録しました」「登録しておきます」等をテキストで言うだけの応答は禁止
- 食事の報告(「〜食べた」「朝はプロテイン」「昼はチキンサラダ」等)を受けたら、同じ応答の中で必ずlog_mealを呼ぶ。栄養素が不明ならあなたが概算してis_estimate=trueで渡す。質問で引き延ばさない(量が全く見当つかない場合のみ1回だけ確認してよい)
- トレの報告→log_workout / ストレスの報告→log_stress / 設定・目標の変更→update_settings / テンプレ登録→add_template・add_workout_template / 誤記録の削除→delete_meal_log
- 複数件の記録は1件ずつツールを呼ぶ。承認されたら間を置かず次の1件のツールを呼び、全件終わるまで続ける
- 例: ユーザー「昼にチキンサラダとおにぎり食べた」→ あなた: log_meal(チキンサラダ、概算)を呼ぶ → 承認後 → log_meal(おにぎり、概算)を呼ぶ → 全件完了後に合計を一言報告

## ユーザー情報
- 身長: ${profile.heightCm ?? '未設定'}cm / 生年月日: ${profile.birthDate ?? '未設定'} / 性別: ${profile.sex === 'male' ? '男性' : '女性'}
- 目標: ${goals}
- 回避食材(DietaryFlag): ${flags}
- 今日のDayType: ${dt?.name ?? '通常日'}

## 直近実績
- 今日の摂取: ${Math.round(todayIntake.kcal)}kcal (P${Math.round(todayIntake.protein)}g F${Math.round(todayIntake.fat)}g C${Math.round(todayIntake.carbs)}g)
- 体重7日平均: ${weightMa != null ? weightMa.toFixed(1) + 'kg' : 'データなし'}
- 実績TDEE: 活動ベース${tdee.activity ?? '算出中'} / 逆算ベース${tdee.reverse ?? `不可(食事記録${tdee.loggedDays}/14日)`}${balanceLine}${stressLine}
${budget ? `- 今週の収支: 予算${budget.budget} / 消費${budget.consumed} / 残り${budget.remaining}kcal (残り${budget.daysLeft}日、日割り${budget.perDayRecommended}kcal)` : ''}

## 今日アプリに記録済みの食事(これが正)
${mealLines}

## 登録済み食事テンプレート(上限30件)
${templates.map((t) => `- ${t.name}${t.aliases.length ? ` (別名: ${t.aliases.join('、')})` : ''}`).join('\n') || '- (なし)'}

## 登録済み運動テンプレート(上限30件)
${workoutTemplates.map((t) => `- ${t.name}`).join('\n') || '- (なし)'}

## 応答方針(重要)
- 日本語(です・ます調)。短く、チャットらしく。1回の返答は長くても5行程度
- 表示はプレーンテキストのみ。マークダウン記法(** ## | --- \` など)は一切使わない。強調したい数値はそのまま書く。箇条書きが必要なら「・」だけを使う
- 数値根拠を示す。曖昧な励ましより具体的な数字
- 「いつもの」等の曖昧な表現はテンプレートの別名と照合する
- 設定変更もあなたの仕事。「身長168にして」「目標体脂肪率13%で9月末までに」等はupdate_settingsツールで変更する
- アプリ内の記録・テンプレート・設定・目標はすべてあなたのツールで操作できる。「アプリからはできません」とは言わない
- 食事の自由入力はあなたがPFCを概算し、is_estimate=trueでlog_mealを呼ぶ
- あなたはツールを呼ばない限り何も記録できない。「記録します」「記録しますね」と言うだけの応答は禁止。記録の意思があるなら同じ応答の中で必ずlog_meal等のツールを呼ぶ
- 記録は必ず1件ずつツールを呼ぶ(まとめて複数を1回の応答で呼ばない)。承認されたら残りの件も1件ずつツールを呼び、全件終わるまで続ける
- 記録系ツールは確認カードで承認されてから確定する。承認前に「記録しました」と言わない
- カロリー赤字はユーザーの楽しみ。赤字が出た日は具体的な数字(貯金額・脂肪換算)で褒める
- 記録済みかどうかはquery_recentで確認してから答える(推測で「記録されていません」と言わない)
- 回避食材が食事に含まれる場合は必ず指摘する
- 医学的診断はしない。今日の日付: ${todayKey}`;
}

/** TDEE計算に必要な入力を組み立てる */
export async function currentTdee() {
  const today = new Date();
  const from = addDays(today, -20); // MA7計算のため余分に取る
  const profile = await getProfile();
  const metricMap = await getRange(toKey(from), toKey(today));
  const intake = await dailyIntake(from.toISOString(), today.toISOString());

  const days: TdeeInput['days'] = [];
  const weightsSoFar: number[] = [];
  let latestWeight: number | null = null;
  for (let i = 20; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = toKey(d);
    const m = metricMap.get(key) ?? {};
    if (m.weight != null) { weightsSoFar.push(m.weight); latestWeight = m.weight; }
    const ma = weightsSoFar.length >= 3 ? mean(weightsSoFar.slice(-7)) : null;
    if (i <= 13) {
      days.push({
        date: key,
        intakeKcal: intake.get(key)?.kcal ?? null,
        steps: m.steps ?? null,
        activeEnergy: m.active_energy ?? null,
        workoutCount: 0,
        weightMA7: ma,
      });
    }
  }
  return computeTdee({ days, profile, latestWeightKg: latestWeight });
}

// ---- 照会系ツールの実行 ----

async function runQueryTool(name: string, input: Record<string, unknown>): Promise<string> {
  const today = new Date();
  if (name === 'query_budget') {
    const tdee = await currentTdee();
    if (tdee.effective == null) return JSON.stringify({ error: 'TDEE算出に必要なデータ(体重・身長・生年月日)が不足しています' });
    const from = addDays(today, -8);
    const intake = await dailyIntake(from.toISOString(), today.toISOString());
    const b = computeBudget({
      tdee: tdee.effective, weekStart: 1, today,
      intakeByDate: new Map([...intake].map(([k, v]) => [k, v.kcal])),
      weeklyDeficitTarget: 0,
    });
    return JSON.stringify({ ...b, tdee });
  }
  if (name === 'query_body_trend') {
    const metric = String(input.metric ?? 'weight');
    const daysN = Number(input.days ?? 30);
    const series = await getSeries(metric as never, toKey(addDays(today, -daysN)), toKey(today));
    const values = series.map((s) => ({ date: s.date, value: s.value }));
    const ma7 = values.length ? mean(values.slice(-7).map((v) => v.value)) : null;
    return JSON.stringify({ metric, count: values.length, ma7, series: values.slice(-daysN) });
  }
  if (name === 'query_forecast') {
    const pf = await planForecast();
    if (!pf.hasPlan) return JSON.stringify({ error: '目標が未設定です(トレンドタブまたはupdate_settingsで設定できます)' });
    return JSON.stringify(pf);
  }
  if (name === 'query_recent') {
    const daysN = Number(input.days ?? 3);
    const from = addDays(today, -daysN);
    const meals = await (await import('@/lib/store')).listMealLogs(from.toISOString(), today.toISOString());
    const workouts = await (await import('@/lib/store')).listWorkoutLogs(from.toISOString(), today.toISOString());
    let last: unknown = null;
    if (input.exercise_name) last = await lastExercise(String(input.exercise_name));
    return JSON.stringify({ meals, workouts, lastExercise: last });
  }
  return JSON.stringify({ error: `unknown tool: ${name}` });
}

// ---- 記録系ツールの実行(承認後に呼ばれる) ----

export async function executeMutation(name: string, input: Record<string, unknown>): Promise<string> {
  const nowIso = new Date().toISOString();
  if (name === 'log_meal') {
    let kcal = Number(input.kcal ?? 0), protein = Number(input.protein ?? 0),
        fat = Number(input.fat ?? 0), carbs = Number(input.carbs ?? 0);
    let templateId: string | null = null;
    if (input.template_name) {
      const t = await findTemplate(String(input.template_name));
      if (t) {
        templateId = t.id;
        const n = await templateNutrition(t);
        kcal = n.kcal; protein = n.protein; fat = n.fat; carbs = n.carbs;
      }
    }
    await addMealLog({
      id: newId(), timestamp: String(input.datetime ?? nowIso),
      templateId, freeText: input.free_text ? String(input.free_text) : null,
      kcal, protein, fat, carbs, isEstimate: Boolean(input.is_estimate),
    });
    // 記録済みになったら当日の食事リマインダーを解除(明日分に予約し直し)
    import('@/lib/notifications').then((m) => m.rescheduleReminders()).catch(() => {});
    return JSON.stringify({ ok: true, recorded: { kcal, protein, fat, carbs } });
  }
  if (name === 'log_workout') {
    let exercises = (input.exercises ?? []) as ExerciseSet[];
    let durationMin = input.duration_min != null ? Number(input.duration_min) : null;
    if (input.template_name) {
      const templates = await listWorkoutTemplates();
      const q = String(input.template_name).trim().toLowerCase();
      const t = templates.find((x) => x.name.toLowerCase() === q);
      if (t) {
        exercises = exercises.length > 0 ? exercises : t.exercises;
        durationMin = durationMin ?? t.durationMin ?? null;
      }
    }
    if (exercises.length === 0) {
      return JSON.stringify({ error: 'テンプレートが見つからず、種目も指定されていません' });
    }
    await addWorkoutLog({
      id: newId(), timestamp: String(input.datetime ?? nowIso),
      exercises, durationMin,
      note: input.note ? String(input.note) : null,
    });
    return JSON.stringify({ ok: true });
  }
  if (name === 'log_stress') {
    await addStressLog({
      id: newId(), timestamp: nowIso,
      level: Math.max(1, Math.min(5, Math.round(Number(input.level)))),
      note: input.note ? String(input.note) : null,
    });
    return JSON.stringify({ ok: true });
  }
  if (name === 'add_workout_template') {
    try {
      await upsertWorkoutTemplate({
        id: newId(), name: String(input.name),
        exercises: (input.exercises ?? []) as ExerciseSet[],
        durationMin: input.duration_min != null ? Number(input.duration_min) : null,
      });
      return JSON.stringify({ ok: true, template: input.name });
    } catch (e) {
      if (e instanceof Error && e.message === 'TEMPLATE_LIMIT') {
        return JSON.stringify({ error: '運動テンプレートは上限30件です。delete_templateで不要なものを削除してください' });
      }
      throw e;
    }
  }
  if (name === 'delete_meal_log') {
    await deleteMealLog(String(input.meal_id));
    return JSON.stringify({ ok: true });
  }
  if (name === 'delete_template') {
    const q = String(input.name).trim().toLowerCase();
    if (input.kind === 'workout') {
      const t = (await listWorkoutTemplates()).find((x) => x.name.toLowerCase() === q);
      if (!t) return JSON.stringify({ error: 'テンプレートが見つかりません' });
      await deleteWorkoutTemplate(t.id);
    } else {
      const t = (await listTemplates()).find((x) => x.name.toLowerCase() === q);
      if (!t) return JSON.stringify({ error: 'テンプレートが見つかりません' });
      await deleteTemplate(t.id);
    }
    return JSON.stringify({ ok: true, deleted: input.name });
  }
  if (name === 'set_day_type') {
    const date = String(input.date ?? toKey(new Date()));
    const name_ = String(input.day_type_name);
    const dayTypes = await getDayTypes();
    let dt = dayTypes.find((d) => d.name === name_);
    if (!dt) {
      dt = { id: newId(), name: name_, mealPlan: [], colorTag: '#D9B36C' };
      await saveDayTypes([...dayTypes, dt]);
    }
    await setDayAssignment(date, dt.id);
    return JSON.stringify({ ok: true, date, dayType: dt.name });
  }
  if (name === 'set_goal') {
    const profile = await getProfile();
    const metric = String(input.metric) as 'body_fat_pct' | 'weight' | 'steps';
    const labelMap = { body_fat_pct: '体脂肪率', weight: '体重', steps: '歩数' } as const;
    const rest = profile.goals.filter((g) => g.metric !== metric);
    const goal = {
      id: newId(), metric, label: labelMap[metric],
      targetValue: Number(input.target_value),
      deadline: String(input.deadline),
      minimumAcceptable: input.minimum_acceptable != null ? Number(input.minimum_acceptable) : undefined,
    };
    await (await import('@/lib/store')).saveProfile({ ...profile, goals: [...rest, goal] });
    return JSON.stringify({ ok: true, goal });
  }
  if (name === 'update_settings') {
    const changed: string[] = [];
    const profile = await getProfile();
    const pPatch: Partial<typeof profile> = {};
    if (input.height_cm != null) { pPatch.heightCm = Number(input.height_cm); changed.push(`身長 ${input.height_cm}cm`); }
    if (input.birth_date != null) { pPatch.birthDate = String(input.birth_date); changed.push(`生年月日 ${input.birth_date}`); }
    if (input.sex != null) { pPatch.sex = input.sex as 'male' | 'female'; changed.push(`性別 ${input.sex === 'male' ? '男性' : '女性'}`); }
    if (Object.keys(pPatch).length > 0) await saveProfile({ ...profile, ...pPatch });

    const plan = await getGoalPlan();
    let planChanged = false;
    if (input.priority_metric != null) { plan.priority = input.priority_metric as 'body_fat' | 'weight'; planChanged = true; changed.push(`重視指標 ${plan.priority === 'body_fat' ? '体脂肪率' : '体重'}`); }
    if (input.target_body_fat_pct != null) { plan.targetBodyFatPct = Number(input.target_body_fat_pct); planChanged = true; changed.push(`目標体脂肪率 ${plan.targetBodyFatPct}%`); }
    if (input.target_weight_kg != null) { plan.targetWeightKg = Number(input.target_weight_kg); planChanged = true; changed.push(`目標体重 ${plan.targetWeightKg}kg`); }
    if (input.target_date != null) { plan.targetDate = String(input.target_date); planChanged = true; changed.push(`期日 ${plan.targetDate}`); }
    if (input.intake_mode != null) { plan.intakeMode = input.intake_mode as 'auto' | 'custom'; planChanged = true; changed.push(`摂取目標 ${plan.intakeMode === 'auto' ? '自動' : '手入力'}`); }
    if (input.custom_intake_kcal != null) { plan.customIntakeKcal = Number(input.custom_intake_kcal); planChanged = true; changed.push(`摂取目標 ${plan.customIntakeKcal}kcal`); }
    if (input.pfc_protein_pct != null || input.pfc_fat_pct != null || input.pfc_carbs_pct != null) {
      plan.pfc = {
        p: Number(input.pfc_protein_pct ?? plan.pfc.p),
        f: Number(input.pfc_fat_pct ?? plan.pfc.f),
        c: Number(input.pfc_carbs_pct ?? plan.pfc.c),
      };
      planChanged = true;
      changed.push(`PFC ${plan.pfc.p}/${plan.pfc.f}/${plan.pfc.c}%`);
    }
    if (planChanged) {
      // 目標の起点を初期化(未設定時)
      if (plan.startDate == null) plan.startDate = toKey(new Date());
      await saveGoalPlan(plan);
    }

    const settings = await loadSettings();
    const sPatch: Partial<typeof settings> = {};
    if (input.sleep_goal_hours != null) { sPatch.sleepGoalMin = Math.round(Number(input.sleep_goal_hours) * 60); changed.push(`睡眠目標 ${input.sleep_goal_hours}時間`); }
    if (input.steps_goal != null) { sPatch.stepsGoal = Math.round(Number(input.steps_goal)); changed.push(`歩数目標 ${input.steps_goal}歩`); }
    if (input.body_fat_score_goal_pct != null) { sPatch.bodyFatGoal = Number(input.body_fat_score_goal_pct); changed.push(`体組成スコア基準 ${input.body_fat_score_goal_pct}%`); }
    if (Object.keys(sPatch).length > 0) await saveSettings({ ...settings, ...sPatch });

    return JSON.stringify({ ok: true, changed });
  }
  if (name === 'add_template') {
    const items = (input.items ?? []) as { name: string; unit: string; quantity: number; kcal: number; protein: number; fat: number; carbs: number }[];
    const refs: { ingredientId: string; quantity: number }[] = [];
    for (const it of items) {
      const id = newId();
      await upsertIngredient({
        id, name: it.name, unit: it.unit,
        kcalPerUnit: it.kcal, proteinPerUnit: it.protein, fatPerUnit: it.fat, carbsPerUnit: it.carbs,
        dietaryTags: [],
      });
      refs.push({ ingredientId: id, quantity: it.quantity });
    }
    const t: FoodTemplate = {
      id: newId(), name: String(input.name),
      aliases: (input.aliases ?? []) as string[],
      items: refs,
    };
    try {
      await upsertTemplate(t);
    } catch (e) {
      if (e instanceof Error && e.message === 'TEMPLATE_LIMIT') {
        return JSON.stringify({ error: '食事テンプレートは上限30件です。delete_templateで不要なものを削除してください' });
      }
      throw e;
    }
    return JSON.stringify({ ok: true, template: t.name });
  }
  return JSON.stringify({ error: `unknown mutation: ${name}` });
}

async function findTemplate(nameOrAlias: string): Promise<FoodTemplate | null> {
  const templates = await listTemplates();
  const q = nameOrAlias.trim().toLowerCase();
  return templates.find((t) =>
    t.name.toLowerCase() === q || t.aliases.some((a) => a.toLowerCase() === q),
  ) ?? null;
}

function summarize(name: string, input: Record<string, unknown>): string {
  if (name === 'log_meal') {
    const what = input.template_name ?? input.free_text ?? '食事';
    const est = input.is_estimate ? '(AI概算)' : '';
    return `食事を記録: ${what}${est}\n${input.kcal ?? '?'}kcal / P${input.protein ?? '?'} F${input.fat ?? '?'} C${input.carbs ?? '?'}`;
  }
  if (name === 'log_workout') {
    const ex = (input.exercises ?? []) as ExerciseSet[];
    return `トレーニングを記録:\n${ex.map((e) => `${e.exerciseName} ${e.weight ?? ''}${e.weightUnit ?? ''} ${e.reps}回×${e.sets}セット`).join('\n')}`;
  }
  if (name === 'set_day_type') return `${input.date ?? '今日'} を「${input.day_type_name}」に設定`;
  if (name === 'update_settings') {
    const labels: Record<string, string> = {
      height_cm: '身長', birth_date: '生年月日', sex: '性別',
      priority_metric: '重視指標', target_body_fat_pct: '目標体脂肪率', target_weight_kg: '目標体重',
      target_date: '期日', intake_mode: '摂取目標の方式', custom_intake_kcal: '摂取目標kcal',
      pfc_protein_pct: 'P%', pfc_fat_pct: 'F%', pfc_carbs_pct: 'C%',
      sleep_goal_hours: '睡眠目標', steps_goal: '歩数目標', body_fat_score_goal_pct: '体組成スコア基準',
    };
    const lines = Object.entries(input)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${labels[k] ?? k}: ${v}`);
    return `設定を変更:\n${lines.join('\n')}`;
  }
  if (name === 'add_template') return `食事テンプレート「${input.name}」を登録`;
  if (name === 'log_stress') {
    const labels = ['', '😌 快調', '🙂 ふつう', '😥 やや疲れ', '😰 つらい', '🤯 限界'];
    return `ストレスを記録: ${labels[Number(input.level)] ?? input.level}${input.note ? `(${input.note})` : ''}`;
  }
  if (name === 'add_workout_template') {
    const ex = (input.exercises ?? []) as ExerciseSet[];
    return `運動テンプレート「${input.name}」を登録:\n${ex.map((e) => `${e.exerciseName} ${e.weight ?? ''}${e.weightUnit ?? ''} ${e.reps}回×${e.sets}セット`).join('\n')}`;
  }
  if (name === 'delete_meal_log') return `食事記録を削除: ${input.description ?? input.meal_id}`;
  if (name === 'delete_template') return `${input.kind === 'workout' ? '運動' : '食事'}テンプレート「${input.name}」を削除`;
  if (name === 'set_goal') {
    const labelMap: Record<string, string> = { body_fat_pct: '体脂肪率', weight: '体重', steps: '歩数' };
    return `目標を設定: ${labelMap[String(input.metric)] ?? input.metric} ${input.target_value} を ${input.deadline} までに`;
  }
  return JSON.stringify(input);
}

// ---- メインループ ----

async function callApi(system: string, messages: ApiMessage[]): Promise<{ content: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[]; stop_reason: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      // adaptive思考でツール選択の精度を上げる(「AIがアホ」対策)
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system,
      tools: TOOLS,
      // 記録系を1件ずつ確認カードに流すため、並列ツール呼び出しを禁止
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      messages,
    }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('BAD_API_KEY');
    if (res.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(`API_ERROR_${res.status}`);
  }
  return res.json();
}

function textOf(content: { type: string; text?: string }[]): string {
  const raw = content.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n').trim();
  return stripMarkdown(raw);
}

/** モデルがマークダウンを混ぜてきた場合の保険(プレーンテキスト化) */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,4}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '・')
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 1ターン実行。照会ツールは自動処理し、記録ツールが出たらpendingで返す。
 * @param history これまでの表示用履歴(user/assistantテキストのみ)
 */
export async function sendChat(userText: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<ChatTurnResult> {
  const system = await buildSystemPrompt();
  const messages: ApiMessage[] = [
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText },
  ];
  return runLoop(system, messages);
}

/** 確認カード承認/拒否後の継続 */
export async function resumeChat(pending: PendingAction, approved: boolean): Promise<ChatTurnResult> {
  const system = await buildSystemPrompt();
  const result = approved
    ? await executeMutation(pending.toolName, pending.input)
    : JSON.stringify({ cancelled: true, note: 'ユーザーが確認カードでキャンセルした' });
  const messages: ApiMessage[] = [
    ...pending.messages,
    {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: pending.toolUseId, content: result }],
    },
  ];
  return runLoop(system, messages);
}

/**
 * 「記録します/しました」と言うだけでツールを呼んでいない応答を検知する。
 * (質問形「記録しますか?」は除外)
 */
function claimsActionWithoutTool(text: string): boolean {
  if (!/(記録|登録|保存|変更|設定|削除)(して(おき)?)?(します|しました|しますね|済みです)/.test(text)) return false;
  if (/(しますか|しましょうか|いいですか|よろしいですか|どうしますか)/.test(text)) return false;
  return true;
}

async function runLoop(system: string, messages: ApiMessage[]): Promise<ChatTurnResult> {
  let collected = '';
  let nudged = false;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await callApi(system, messages);
    const text = textOf(res.content);

    if (res.stop_reason !== 'tool_use') {
      // 「記録します」と言うだけで実際にはツールを呼んでいない応答は、
      // 1回だけシステム側から強制的にやり直させる(チャットが記録しないバグの恒久対策)
      if (!nudged && text && claimsActionWithoutTool(text)) {
        nudged = true;
        messages.push({ role: 'assistant', content: res.content });
        messages.push({
          role: 'user',
          content: '(システム検証: 直前の応答はツールを呼んでいないため、実際には何も記録・変更されていません。該当するツール(log_meal / log_workout / log_stress / update_settings 等)を今すぐ呼んでください。情報が足りない場合のみユーザーに短く質問してください)',
        });
        continue; // この偽の応答テキストはユーザーに見せない
      }
      if (text) collected = collected ? `${collected}\n${text}` : text;
      return { text: collected || '(応答なし)', pending: null };
    }

    if (text) collected = collected ? `${collected}\n${text}` : text;

    messages.push({ role: 'assistant', content: res.content });
    const toolUses = res.content.filter((b) => b.type === 'tool_use');
    const results: unknown[] = [];
    for (const tu of toolUses) {
      const name = tu.name as string;
      const input = (tu.input ?? {}) as Record<string, unknown>;
      if (MUTATION_TOOLS.has(name)) {
        // 記録系: 確認カードへ。複数同時の場合も1件ずつ確認する
        return {
          text: collected,
          pending: {
            toolName: name,
            toolUseId: tu.id as string,
            input,
            summary: summarize(name, input),
            messages,
          },
        };
      }
      results.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: await runQueryTool(name, input),
      });
    }
    messages.push({ role: 'user', content: results });
  }
  return { text: collected || '(処理が長くなりすぎたため中断しました)', pending: null };
}

export { TOOLS };
