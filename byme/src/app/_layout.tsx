import {
  Jost_500Medium,
  Jost_600SemiBold,
  Jost_700Bold,
} from '@expo-google-fonts/jost';
import {
  ZenKakuGothicNew_400Regular,
  ZenKakuGothicNew_500Medium,
  ZenKakuGothicNew_700Bold,
  ZenKakuGothicNew_900Black,
} from '@expo-google-fonts/zen-kaku-gothic-new';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { migrateDbIfNeeded } from '../db/schema';
import { configureNotificationHandler } from '../lib/notifications';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Jost_500Medium,
    Jost_600SemiBold,
    Jost_700Bold,
    ZenKakuGothicNew_400Regular,
    ZenKakuGothicNew_500Medium,
    ZenKakuGothicNew_700Bold,
    ZenKakuGothicNew_900Black,
  });

  if (!fontsLoaded) return null;

  return (
    <SQLiteProvider databaseName="byme.db" onInit={migrateDbIfNeeded}>
      <Bootstrap>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="declare-mode"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        </Stack>
      </Bootstrap>
    </SQLiteProvider>
  );
}

function Bootstrap({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    init(db).finally(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
  }, [db, init]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  return <>{children}</>;
}
