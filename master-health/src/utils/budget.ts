/**
 * 週次収支エンジン
 * ================
 * 週予算 = 実績TDEE × 7 (デフォルト月曜起点。設定で変更可)
 * 目標が減量なら、日次赤字目標を織り込んだ「調整後予算」も返す。
 *
 * 減量ペースの根拠: 体脂肪1kg ≈ 7700kcal。
 * 例: 週0.4kg減を狙うなら 週赤字 = 0.4 × 7700 = 3080kcal (日440kcal)。
 * ペースはGoal(deadlineと現在値)から必要ペースを逆算する。
 */

export interface BudgetInput {
  tdee: number;                       // 実績TDEE (kcal/日)
  weekStart: 0 | 1;                   // 0=日曜, 1=月曜
  today: Date;
  /** ローカル日付キー → 摂取kcal (今週分) */
  intakeByDate: Map<string, number>;
  /** 週あたりの目標赤字kcal (減量目標が無ければ0) */
  weeklyDeficitTarget: number;
}

export interface BudgetResult {
  weekStartDate: string;
  budget: number;          // 週予算 (TDEE×7 - 目標赤字)
  consumed: number;        // 今週の摂取合計
  remaining: number;
  daysLeft: number;        // 今日を含む残り日数
  perDayRecommended: number;
  overPace: boolean;       // このままだと予算超過ペースか
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今週の起点日を返す */
export function weekStartOf(today: Date, weekStart: 0 | 1): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function computeBudget(input: BudgetInput): BudgetResult {
  const start = weekStartOf(input.today, input.weekStart);
  const budget = Math.round(input.tdee * 7 - input.weeklyDeficitTarget);

  let consumed = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d > input.today) break;
    consumed += input.intakeByDate.get(dateKey(d)) ?? 0;
  }

  const dayIndex = Math.floor((input.today.getTime() - start.getTime()) / 86400000);
  const daysLeft = 7 - dayIndex; // 今日を含む
  const remaining = budget - consumed;
  // 週の途中から記録を始めると残額÷残日数が非現実的に膨らむため、TDEEでキャップする
  // (「1日5,732kcal食べてよい」のような推奨を出さない)
  const perDayRecommended = daysLeft > 0
    ? Math.min(Math.round(remaining / daysLeft), Math.round(input.tdee))
    : 0;
  // 経過日数に対する均等配分と比べて消費が先行していれば超過ペース
  const expectedByNow = (budget / 7) * (dayIndex + 1);
  return {
    weekStartDate: dateKey(start),
    budget,
    consumed: Math.round(consumed),
    remaining: Math.round(remaining),
    daysLeft,
    perDayRecommended,
    overPace: consumed > expectedByNow,
  };
}
