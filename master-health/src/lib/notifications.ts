/**
 * ローカル通知 (expo-notifications)
 * - 朝8時: 今日のプラン準備の通知
 * - 食事リマインダー: 朝・昼・夜それぞれON/OFF+時刻設定(設定から変更可)
 * - 夜の「本日確定」通知(デフォルト22:00、変更可)
 *
 * 繰り返し通知は「その日だけスキップ」ができないため、常に一発ものを
 * 「次の発火時刻」で予約し直す方式にする。アプリ起動時と食事記録時に再計算する。
 * 通知のdata.urlはタップ時の遷移先(_layoutのresponseリスナーが処理)。
 */
import * as Notifications from 'expo-notifications';

import { loadSettings, type MealReminder } from '@/lib/settings';
import { dailyIntake, localDateKey } from '@/lib/store';

const MORNING_ID = 'morning-plan';
const MEAL_IDS = { morning: 'meal-morning', lunch: 'meal-lunch', dinner: 'meal-dinner' } as const;
const CONFIRM_ID = 'confirm-day';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/** 'HH:mm' → {hour, minute}。壊れた値は null */
function parseTime(t: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** 次のhh:mm発火時刻(過ぎていれば明日) */
function nextFireDate(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

async function replaceScheduled(id: string, content: Notifications.NotificationContentInput, date: Date): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

async function cancelScheduled(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/**
 * リマインダー一式を再予約する。
 * アプリ起動時・フォアグラウンド復帰時・食事記録時・設定変更時に呼ぶ。
 */
export async function rescheduleReminders(): Promise<void> {
  if (!(await ensurePermission())) return;
  const settings = await loadSettings();

  // 朝プラン: 次の8:00
  await replaceScheduled(MORNING_ID, {
    title: 'おはようございます ☀️',
    body: '今日のプランが準備できました。チャットを開いて確認しましょう。',
    data: { url: '/chat' },
  }, nextFireDate(8));

  // 今日すでに記録があるか(今日分の食事リマインダーのスキップ判定)
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let todayKcal = 0;
  try {
    const intake = await dailyIntake(dayStart.toISOString(), dayEnd.toISOString());
    todayKcal = intake.get(localDateKey(now.toISOString()))?.kcal ?? 0;
  } catch { /* 未取得なら未記録扱い */ }

  // 食事リマインダー(朝・昼・夜)
  const meals: { key: keyof typeof MEAL_IDS; label: string; r: MealReminder }[] = [
    { key: 'morning', label: '朝食', r: settings.mealReminders.morning },
    { key: 'lunch', label: '昼食', r: settings.mealReminders.lunch },
    { key: 'dinner', label: '夕食', r: settings.mealReminders.dinner },
  ];
  for (const { key, label, r } of meals) {
    if (!r.enabled) { await cancelScheduled(MEAL_IDS[key]); continue; }
    const t = parseTime(r.time) ?? parseTime(key === 'morning' ? '09:00' : key === 'lunch' ? '13:00' : '21:00')!;
    // 今日まだその時刻前で、かつ今日の記録がゼロなら今日発火。それ以外は明日
    const fire = nextFireDate(t.hour, t.minute);
    const isToday = localDateKey(fire.toISOString()) === localDateKey(now.toISOString());
    if (isToday && todayKcal > 0 && key !== 'dinner') {
      // 既に記録がある日は朝・昼をスキップして明日分を予約(夕食は夜の追記が多いので出す)
      fire.setDate(fire.getDate() + 1);
    }
    await replaceScheduled(MEAL_IDS[key], {
      title: `${label}の記録をお忘れなく 🍚`,
      body: 'タップでMr. Vytaへ。話すだけ・写真1枚でもOKです。',
      data: { url: '/chat' },
    }, fire);
  }

  // 夜の「本日確定」通知
  if (settings.confirmReminder.enabled) {
    const t = parseTime(settings.confirmReminder.time) ?? { hour: 22, minute: 0 };
    await replaceScheduled(CONFIRM_ID, {
      title: '今日の食事はこれで全部ですか?',
      body: 'タップして本日の記録を確認・確定しましょう。確定すると累積赤字に反映されます。',
      data: { url: '/?confirm=1' },
    }, nextFireDate(t.hour, t.minute));
  } else {
    await cancelScheduled(CONFIRM_ID);
  }
}
