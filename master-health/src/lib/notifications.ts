/**
 * ローカル通知 (expo-notifications)
 * - 朝8時: 今日のプラン準備の通知
 * - 14時: 食事記録がまだない場合のリマインダー
 *
 * 繰り返し通知は「その日だけスキップ」ができないため、常に一発ものを
 * 「次の発火時刻」で予約し直す方式にする。アプリ起動時と食事記録時に再計算する。
 */
import * as Notifications from 'expo-notifications';

import { dailyIntake, localDateKey } from '@/lib/store';

const MEAL_ID = 'meal-reminder';
const MORNING_ID = 'morning-plan';

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

/**
 * リマインダー一式を再予約する。
 * アプリ起動時・フォアグラウンド復帰時・食事記録時に呼ぶ。
 */
export async function rescheduleReminders(): Promise<void> {
  if (!(await ensurePermission())) return;

  // 朝プラン: 次の8:00
  await replaceScheduled(MORNING_ID, {
    title: 'おはようございます ☀️',
    body: '今日のプランが準備できました。チャットを開いて確認しましょう。',
  }, nextFireDate(8));

  // 食事リマインダー: 今日まだ未記録で14時前なら今日14:00、それ以外は明日14:00
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let loggedToday = false;
  try {
    const intake = await dailyIntake(dayStart.toISOString(), now.toISOString());
    loggedToday = (intake.get(localDateKey(now.toISOString()))?.kcal ?? 0) > 0;
  } catch { /* 未取得なら未記録扱い */ }

  const fireToday = now.getHours() < 14 && !loggedToday;
  const d = new Date();
  d.setHours(14, 0, 0, 0);
  if (!fireToday) d.setDate(d.getDate() + 1);
  await replaceScheduled(MEAL_ID, {
    title: '食事の記録がまだのようです 🍚',
    body: '報告タブから写真かバーコードで10秒記録。カロリー貯金を続けましょう。',
  }, d);
}
