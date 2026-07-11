import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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

export async function setBadgeCount(n) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, n | 0));
  } catch {}
}

export async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'リマインダー',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

// 動作確認用: 5秒後に1回だけ鳴らす
export async function scheduleTestNotification() {
  const ok = await ensurePermission();
  if (!ok) return false;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ADHDo テスト通知 🎉',
      body: 'これが見えていれば通知は正しく動いています',
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
  return true;
}

// アプリ(WebView)から送られてきたスケジュールで毎日繰り返しのローカル通知を組み直す
// - 予定開始時刻: 「◯◯の時間です。まずは最初のサブ項目から」
// - 5分前: 切り替え予告(ADHDの作業切り替え支援)
// 戻り値: セットした通知の件数(-1 = 権限なし)
export async function rescheduleNotifications(events, notify, notifySubs) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!notify || !events || !events.length) return 0;

    const ok = await ensurePermission();
    if (!ok) return -1;
    await ensureChannel();

    const MAX = 60; // iOSのローカル通知は64件まで。余裕を持って60件で打ち切る
    let count = 0;
    for (const e of events) {
      if (count >= MAX) break;
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
      count++;

      // 事前通知は予定ごとに分数を設定できる(null=なし / 既定5分前)
      const preMin = e.pre === undefined ? 5 : e.pre;
      if (preMin !== null && preMin > 0) {
        const pre = (e.start - preMin + 1440) % 1440;
        const label = preMin >= 60 ? `${Math.floor(preMin / 60)}時間${preMin % 60 ? preMin % 60 + '分' : ''}` : `${preMin}分`;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${label}後: ${e.title}`,
            body: 'そろそろ切り替えの準備をしよう',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: Math.floor(pre / 60),
            minute: pre % 60,
          },
        });
        count++;
      }
    }

    // サブ項目の開始時刻にも通知(設定でON/OFF可・件数上限まで)
    if (notifySubs) {
      for (const e of events) {
        for (const s of e.subs || []) {
          if (count >= MAX) break;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `▶ ${s.name}`,
              body: `「${e.title}」の次のステップ`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: Math.floor(s.start / 60),
              minute: s.start % 60,
            },
          });
          count++;
        }
      }
    }
    return count;
  } catch (err) {
    console.warn('notification scheduling failed', err);
    return -2;
  }
}
