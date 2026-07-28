import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { toDateKey } from './dates';

/**
 * v3 通知。「自分を刷り込む」ための静かなリマインダー。
 * - 朝(起床時刻): 開始の合図(曜日設定に対応するためWEEKLYで組む)
 * - 昼・夕・夜: 未完了の日だけ届く(今日〜7日先までDATEトリガーで組み、状態変化時に組み直す)
 * - 攻撃的・罪悪感過多な文言は使わない
 * - すべてローカル通知(リモートpushなし)
 */

const PREFIX = 'byme3-';

export interface NotifyConfig {
  wake: { hour: number; minute: number };
  noon: { hour: number; minute: number };
  evening: { hour: number; minute: number };
  night: { hour: number; minute: number };
  morningEnabled: boolean;
  noonEnabled: boolean;
  eveningEnabled: boolean;
  nightEnabled: boolean;
  /** 通知する曜日(0=日〜6=土) */
  days: number[];
  /** 今日すでに完了しているか */
  todayComplete: boolean;
}

export const MORNING_BODY = '自分の人生を思い出す時間です。';
export const NOON_BODY = '今日のBYMEは、まだ完了していません。';
export const EVENING_BODY = '3分あれば、今日の自分に戻れます。';
export const NIGHT_BODY = '60秒のQUICKだけでも、今日をゼロにしない。';

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

async function cancelAllByme(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );
}

/**
 * 通知を全て組み直す。アプリ起動時・設定変更時・儀式完了時に呼ぶ。
 * タップ時は data.url で TODAY(途中セッションがあれば再開表示)へ誘導する。
 */
export async function rescheduleAll(cfg: NotifyConfig): Promise<void> {
  await ensureAndroidChannel();
  await cancelAllByme();

  const data = { url: '/(tabs)/today' };

  // 朝: 曜日ごとのWEEKLY(expoのweekdayは 1=日曜〜7=土曜)
  if (cfg.morningEnabled) {
    for (const day of cfg.days) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}morning-w${day}`,
        content: { title: 'BYME', body: MORNING_BODY, data },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1,
          hour: cfg.wake.hour,
          minute: cfg.wake.minute,
        },
      });
    }
  }

  // 昼・夕・夜: 今日から7日分をDATEで組む(完了した今日はスキップ)
  const now = new Date();
  const slots: {
    key: string;
    enabled: boolean;
    time: { hour: number; minute: number };
    body: string;
  }[] = [
    { key: 'noon', enabled: cfg.noonEnabled, time: cfg.noon, body: NOON_BODY },
    { key: 'evening', enabled: cfg.eveningEnabled, time: cfg.evening, body: EVENING_BODY },
    { key: 'night', enabled: cfg.nightEnabled, time: cfg.night, body: NIGHT_BODY },
  ];
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!cfg.days.includes(day.getDay())) continue;
    const isToday = offset === 0;
    if (isToday && cfg.todayComplete) continue;
    for (const slot of slots) {
      if (!slot.enabled) continue;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.time.hour, slot.time.minute, 0);
      if (at.getTime() <= now.getTime()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${slot.key}-${toDateKey(day)}`,
        content: { title: 'BYME', body: slot.body, data },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  }
}
