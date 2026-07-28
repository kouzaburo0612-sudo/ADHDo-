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
const KPI_ID = 'byme-kpi-sunday';
const KPI_HOUR = 18; // 日曜夕

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
