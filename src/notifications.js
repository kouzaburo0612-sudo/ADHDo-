import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const fmt = (m) => {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
};

// アプリ(WebView)から送られてきたスケジュールで毎日繰り返しのローカル通知を組み直す
// - 予定開始時刻: 「◯◯の時間です。まずは最初のサブ項目から」
// - 5分前: 切り替え予告(ADHDの作業切り替え支援)
export async function rescheduleNotifications(events, notify) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!notify || !events || !events.length) return;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'リマインダー',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    for (const e of events) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${e.title} の時間です`,
          body: e.firstSub ? `まずは「${e.firstSub}」から始めよう` : `${fmt(e.start)} – ${fmt(e.end)}`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(e.start / 60),
          minute: e.start % 60,
        },
      });

      const pre = (e.start - 5 + 1440) % 1440;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `5分後: ${e.title}`,
          body: 'そろそろ切り替えの準備をしよう',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(pre / 60),
          minute: pre % 60,
        },
      });
    }
  } catch (err) {
    console.warn('notification scheduling failed', err);
  }
}
