import {
  Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold, useFonts,
} from '@expo-google-fonts/montserrat';
import * as ExpoLinking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { DarkTheme, ThemeProvider, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Onboarding } from '@/components/Onboarding';
import { Colors } from '@/constants/theme';
import { kvGet, kvSet } from '@/lib/db';
import { rescheduleReminders } from '@/lib/notifications';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.bg,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    primary: Colors.accent,
  },
};

export default function RootLayout() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  // ブランドフォント(ロゴと同系の幾何学サンセリフ)。ロード完了までスプラッシュ表示のまま待つ
  const [fontsLoaded, fontsError] = useFonts({
    Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold,
  });

  // 起動時とフォアグラウンド復帰時にリマインダー(朝プラン・食事)を予約し直す
  useEffect(() => {
    rescheduleReminders().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') rescheduleReminders().catch(() => {});
    });
    // 初回起動のみチュートリアルを出す
    kvGet('onboarded_v1').then((v) => { if (!v) setShowOnboarding(true); }).catch(() => {});
    // 通知タップ → data.urlの画面へ(食事リマインダー=/chat、本日確定=/?confirm=1)
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        setTimeout(() => router.push(url as never), 300); // ナビゲーション初期化待ち
      }
    });
    // Withings OAuthの戻り(vyta://withings-callback?code=...)をトークン交換につなぐ
    const handleDeepLink = (url: string) => {
      if (!url.includes('withings-callback')) return;
      const { queryParams } = ExpoLinking.parse(url);
      const code = String(queryParams?.code ?? '');
      const state = String(queryParams?.state ?? '');
      const err = String(queryParams?.error ?? '');
      if (err) { Alert.alert('Withings連携', `認可がキャンセルされました(${err})`); return; }
      import('@/lib/withings')
        .then((m) => m.completeWithingsAuth(code, state))
        .then((r) => Alert.alert('Withings連携完了 ⚖️', `過去1年分のデータ(${r.synced}件)を取り込みました。Body Dataタブで確認できます。`))
        .catch((e) => Alert.alert('Withings連携に失敗しました', e instanceof Error ? e.message : String(e)));
    };
    Linking.getInitialURL().then((u) => { if (u) handleDeepLink(u); }).catch(() => {});
    const linkSub = Linking.addEventListener('url', (e) => handleDeepLink(e.url));
    return () => { sub.remove(); notifSub.remove(); linkSub.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishOnboarding = () => {
    setShowOnboarding(false);
    kvSet('onboarded_v1', 'done').catch(() => {});
  };

  if (!fontsLoaded && !fontsError) return null; // スプラッシュのまま待機(通常は一瞬)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <NativeTabs
          backgroundColor={Colors.bg}
          indicatorColor={Colors.surfaceRaised}
          iconColor={Colors.textSecondary}
          tintColor={Colors.accent}
          labelStyle={{ color: Colors.textSecondary, selected: { color: Colors.accent } }}
        >
          {/* 左から My Body / Body Data / Mr. Vyta / トレンド / More(自前画面。
              6個以上にするとiOSが素のMoreリストを自動生成して品質が落ちるため5個厳守) */}
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Label>My Body</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'heart.text.square', selected: 'heart.text.square.fill' }} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="bodydata">
            <NativeTabs.Trigger.Label>Body Data</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'waveform.path.ecg.rectangle', selected: 'waveform.path.ecg.rectangle.fill' }} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="chat">
            <NativeTabs.Trigger.Label>Mr. Vyta</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.text.bubble.right', selected: 'bubble.left.and.text.bubble.right.fill' }} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="history">
            <NativeTabs.Trigger.Label>トレンド</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="more">
            <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} />
          </NativeTabs.Trigger>
        </NativeTabs>
        <Onboarding visible={showOnboarding} onDone={finishOnboarding} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
