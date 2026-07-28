import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, enLabel, fonts } from '../../theme/tokens';

const TAB_LABELS: Record<string, { en: string; jp: string }> = {
  today: { en: 'TODAY', jp: '今日' },
  master: { en: 'MASTER', jp: '正本' },
  history: { en: 'HISTORY', jp: '記録' },
  settings: { en: 'SETTINGS', jp: '設定' },
};

/** 英字ラベル+日本語サブラベル、アクティブ時はブルーの下線 */
function BymeTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = TAB_LABELS[route.name] ?? { en: route.name.toUpperCase(), jp: '' };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={`${label.en} ${label.jp}`}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={styles.tab}
          >
            <Text style={[styles.en, focused && styles.enActive]}>{label.en}</Text>
            <Text style={[styles.jp, focused && styles.jpActive]}>{label.jp}</Text>
            <View style={[styles.underline, focused && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.paper },
      }}
      tabBar={(props) => <BymeTabBar {...props} />}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="master" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  en: {
    ...enLabel,
    fontSize: 12,
    color: colors.mist,
  },
  enActive: {
    color: colors.ink,
  },
  jp: {
    fontFamily: fonts.jp,
    fontSize: 9,
    color: colors.mist,
  },
  jpActive: {
    color: colors.inkSoft,
  },
  underline: {
    marginTop: 4,
    height: 2,
    width: 28,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: colors.blue,
  },
});
