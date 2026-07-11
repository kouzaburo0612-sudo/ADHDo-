import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * ローカル通知。
 * - 朝: ユーザー設定時刻。本文にはその日の宣言文を1つ載せる(通知自体がアファメーション)
 * - 夜21時: 日記未記入リマインド(オフ可)
 * リモートpushは使わない(aps-environment はプラグインで除去済み)。
 */

const MORNING_ID = 'byme-morning';
const EVENING_ID = 'byme-evening';
const EVENING_HOUR = 21;

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

/**
 * 朝の宣言通知を(再)スケジュールする。
 * 毎日同時刻に届く。本文の宣言文はアプリを開くたびに当日のローテーションで更新される。
 */
export async function scheduleMorningNotification(
  hour: number,
  minute: number,
  affirmationText: string
): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_ID,
    content: {
      title: 'BE / 今日の宣言',
      body: affirmationText,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelMorningNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
}

/**
 * 21時の日記リマインドを更新する。
 * 「今日まだ日記を書いていない」場合のみ今日21時に一発通知を置き、
 * 書き終えている・21時を過ぎている場合は翌日21時に置く。
 * アプリ起動時と日記保存時に呼び直すことで「未記入のときだけ鳴る」を実現する。
 */
export async function refreshEveningReminder(
  enabled: boolean,
  journalDoneToday: boolean
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => {});
  if (!enabled) return;
  await ensureAndroidChannel();

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), EVENING_HOUR, 0, 0);
  if (journalDoneToday || now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_ID,
    content: {
      title: 'LOG / 今日の日記',
      body: '今日を締めくくる3行を。感謝・前進・明日。',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}
