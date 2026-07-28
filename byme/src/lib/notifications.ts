import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * push型刷り込み(仕様6.5)。
 * - 毎朝(起床時刻): 本文に今日の指針または宣言文をそのまま載せる
 * - 日曜夕: KPI現在値の更新催促
 * 通知文はコンテンツそのもの。「アプリを開いてください」的な文言は書かない。
 * リモートpushは使わない(aps-environment はプラグインで除去済み)。
 */

const MORNING_ID = 'byme-morning';
const NOON_ID = 'byme-noon';
const EVENING_ID = 'byme-evening';
const STREAK_ID = 'byme-streak-guard';
const KPI_ID = 'byme-kpi-sunday';
const KPI_HOUR = 18; // 日曜夕
const NOON_HOUR = 12;
const NOON_MINUTE = 30;
const EVENING_HOUR = 17;
const EVENING_MINUTE = 30;
const STREAK_HOUR = 21;
const STREAK_MINUTE = 30;

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'BYME',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** 毎朝、起床時刻に今日の指針を届ける(通知自体が刷り込み) */
export async function scheduleMorningNotification(
  hour: number,
  minute: number,
  principleText: string
): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_ID,
    content: {
      title: 'TODAY’S CREED',
      body: principleText,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/**
 * 昼・夕の刷り込み通知(オフ可)。
 * 昼: 残り日数+指針 / 夕: アファメーション本文。開かなくても刷り込まれる。
 */
export async function scheduleExtraNotifications(
  enabled: boolean,
  noonBody: string,
  eveningBody: string
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOON_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => {});
  if (!enabled) return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: NOON_ID,
    content: { title: 'THE NUMBERS', body: noonBody },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: NOON_HOUR,
      minute: NOON_MINUTE,
    },
  });
  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_ID,
    content: { title: 'BE', body: eveningBody },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: EVENING_HOUR,
      minute: EVENING_MINUTE,
    },
  });
}

/**
 * ストリーク防衛通知(損失回避)。
 * 今日の儀式が未完了のときだけ、今夜21:30に一発。完了したらキャンセルされる。
 */
export async function refreshStreakGuard(
  enabled: boolean,
  todayComplete: boolean,
  streak: number
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(STREAK_ID).catch(() => {});
  if (!enabled || todayComplete) return;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), STREAK_HOUR, STREAK_MINUTE, 0);
  if (now.getTime() >= target.getTime()) return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_ID,
    content: {
      title: 'STREAK',
      body:
        streak > 0
          ? `${streak}日連続が今夜0時に消える。儀式は3分で終わる。`
          : '今日を1日目にせよ。儀式は3分で終わる。',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}

/** 日曜夕のKPI更新催促(オフ可) */
export async function scheduleSundayKpiReminder(enabled: boolean): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(KPI_ID).catch(() => {});
  if (!enabled) return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: KPI_ID,
    content: {
      title: 'THE NUMBERS',
      body: 'KPI現在値を更新せよ。1日も、1円も、ごまかせない。',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // 日曜
      hour: KPI_HOUR,
      minute: 0,
    },
  });
}
