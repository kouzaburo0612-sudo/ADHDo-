import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { T } from '../theme';

const TABS = [
  { key: 'home', label: 'ホーム', icon: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 10.5 12 3l9 7.5" /><Path d="M5 9.5V21h14V9.5" /><Path d="M9.5 21v-6h5v6" />
    </Svg>
  )},
  { key: 'meditate', label: '瞑想', icon: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={5.5} r={2.2} /><Path d="M12 8v4.5" /><Path d="M6 20c1-4 3.5-6 6-6s5 2 6 6" />
      <Path d="M4.5 15.5c2 .8 3.5 2 4 4.5M19.5 15.5c-2 .8-3.5 2-4 4.5" />
    </Svg>
  )},
  { key: 'diary', label: '日記', icon: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4z" /><Path d="M5 4a2 2 0 0 1 2-2h11v16" /><Path d="M9 8h6M9 12h6" />
    </Svg>
  )},
  { key: 'affirm', label: 'アファメーション', small: true, icon: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20s-7-4.4-9-8.5C1.5 8 3.5 5 6.7 5c2 0 3.6 1.2 5.3 3.2C13.7 6.2 15.3 5 17.3 5c3.2 0 5.2 3 3.7 6.5-2 4.1-9 8.5-9 8.5z" />
    </Svg>
  )},
  { key: 'profile', label: 'プロフィール', icon: (c) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={3.5} /><Path d="M5 20c.8-3.8 3.6-5.5 7-5.5s6.2 1.7 7 5.5" />
    </Svg>
  )},
];

export default function Footer({ tab, setTab }) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const active = tab === t.key;
        const color = active ? T.ink : T.ink3;
        return (
          <TouchableOpacity key={t.key} style={styles.btn} onPress={() => setTab(t.key)}>
            {t.icon(color)}
            <Text style={[styles.label, t.small && styles.labelSmall, { color }]} numberOfLines={1}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingTop: 8,
    paddingBottom: 6,
  },
  btn: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 9.5, fontWeight: '600' },
  labelSmall: { fontSize: 8 },
});
