import { DarkTheme, ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
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
  // 起動時とフォアグラウンド復帰時にリマインダー(朝プラン・食事)を予約し直す
  useEffect(() => {
    rescheduleReminders().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') rescheduleReminders().catch(() => {});
    });
    return () => sub.remove();
  }, []);

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
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Label>My Body</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'heart.text.square', selected: 'heart.text.square.fill' }} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="chat">
            <NativeTabs.Trigger.Label>チャット</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.text.bubble.right', selected: 'bubble.left.and.text.bubble.right.fill' }} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="report">
            <NativeTabs.Trigger.Label>報告</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'fork.knife.circle', selected: 'fork.knife.circle.fill' }} />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="history">
            <NativeTabs.Trigger.Label>トレンド</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="settings">
            <NativeTabs.Trigger.Label>設定</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
          </NativeTabs.Trigger>
        </NativeTabs>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
