import {
  Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold, useFonts,
} from '@expo-google-fonts/montserrat';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
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
    return () => sub.remove();
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
          {/* 左から My Body / 実績報告 / Mr. Vyta / トレンド / More(自前画面。
              6個以上にするとiOSが素のMoreリストを自動生成して品質が落ちるため5個厳守) */}
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Label>My Body</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'heart.text.square', selected: 'heart.text.square.fill' }} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="report">
            <NativeTabs.Trigger.Label>実績報告</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'fork.knife.circle', selected: 'fork.knife.circle.fill' }} />
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
