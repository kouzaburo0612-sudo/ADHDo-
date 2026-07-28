import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, PrimaryButton } from '../../components/ui';
import { LIFE_GOALS, ROADMAP, ROADMAP_STRATEGY } from '../../data/master';
import type { SettingKey } from '../../db/types';
import { useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

const MVV_KEYS: { key: SettingKey; en: string; jp: string }[] = [
  { key: 'identity', en: 'IDENTITY', jp: 'アイデンティティ' },
  { key: 'mvv_mission', en: 'MISSION', jp: '使命' },
  { key: 'mvv_vision', en: 'VISION', jp: '未来' },
  { key: 'mvv_values_company', en: 'VALUES', jp: '行動指針(会社)' },
  { key: 'theme_2026', en: 'THEME 2026', jp: '今年のテーマ' },
];

export default function Vision() {
  const settings = useAppStore((s) => s.settings);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const [editing, setEditing] = useState<SettingKey | null>(null);
  const [draft, setDraft] = useState('');
  const currentYear = new Date().getFullYear();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 到達点ヒーロー */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>FINAL DESTINATION</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroNum}>6,500</Text>
              <Text style={styles.heroUnit}>億円 — 2034</Text>
            </View>
            <Text style={styles.heroSub}>離島から、1兆円へ。</Text>
          </View>

          {/* ロードマップ */}
          <Text style={styles.strategy}>{ROADMAP_STRATEGY}</Text>
          <View style={styles.rmWrap}>
            {ROADMAP.map((r, i) => {
              const isNow = r.year === currentYear;
              const isPast = r.year < currentYear;
              return (
                <View key={r.year} style={styles.rmItem}>
                  {i < ROADMAP.length - 1 ? <View style={styles.rmLine} /> : null}
                  <View
                    style={[
                      styles.rmDot,
                      isNow && styles.rmDotNow,
                      isPast && styles.rmDotPast,
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.rmHead}>
                      <Text style={[styles.rmYear, isNow && { color: colors.blue }]}>{r.year}</Text>
                      <Text style={styles.rmAge}>{r.age}歳</Text>
                      {isNow ? (
                        <View style={styles.nowBadge}>
                          <Text style={styles.nowBadgeText}>NOW</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rmRev}>
                      売上 {r.rev} / EBITDA {r.ebitda}
                    </Text>
                    {r.note ? <Text style={styles.rmNote}>{r.note}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* 人生の到達点 */}
          <View style={styles.section}>
            <Text style={styles.secLabel}>LIFE GOALS — 人生の到達点</Text>
            <View style={styles.card}>
              {LIFE_GOALS.map((g, i) => (
                <View key={i} style={styles.goalRow}>
                  <Text style={styles.goalMark}>▸</Text>
                  <Text style={styles.goalText}>{g}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* MVV(編集可) */}
          <View style={styles.section}>
            <Text style={styles.secLabel}>MVV</Text>
            {MVV_KEYS.map(({ key, en, jp }) => {
              const value = settings[key] ?? '';
              const isEditing = editing === key;
              return (
                <View key={key} style={styles.card}>
                  <View style={styles.mvvHead}>
                    <Text style={styles.mvvEn}>{en}</Text>
                    <Text style={styles.mvvJp}>{jp}</Text>
                  </View>
                  {isEditing ? (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      <Field multiline value={draft} onChangeText={setDraft} autoFocus />
                      <PrimaryButton
                        title="保存"
                        onPress={async () => {
                          await saveSetting(key, draft.trim());
                          setEditing(null);
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setDraft(value);
                        setEditing(key);
                      }}
                    >
                      <Text style={styles.mvvText}>{value || 'タップして書く'}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    paddingBottom: 40,
  },
  hero: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
  },
  heroLabel: {
    ...enLabel,
    fontSize: 11,
    color: colors.mist,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  heroNum: {
    fontFamily: fonts.enSemi,
    fontSize: 56,
    lineHeight: 64,
    color: colors.ink,
  },
  heroUnit: {
    fontFamily: fonts.en,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.mist,
  },
  heroSub: {
    fontFamily: fonts.jpBold,
    fontSize: 12,
    color: colors.red,
    marginTop: 2,
  },
  strategy: {
    fontFamily: fonts.jp,
    fontSize: 11,
    lineHeight: 18,
    color: colors.mist,
    paddingHorizontal: spacing.screenX,
    marginTop: 10,
    marginBottom: 14,
  },
  rmWrap: {
    paddingHorizontal: spacing.screenX,
  },
  rmItem: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 22,
    position: 'relative',
  },
  rmLine: {
    position: 'absolute',
    left: 7,
    top: 18,
    bottom: 0,
    width: 2,
    backgroundColor: colors.line,
  },
  rmDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: colors.white,
    marginTop: 3,
    zIndex: 1,
  },
  rmDotNow: {
    borderColor: colors.blue,
    backgroundColor: colors.blue,
  },
  rmDotPast: {
    borderColor: colors.blue,
  },
  rmHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rmYear: {
    fontFamily: fonts.enSemi,
    fontSize: 18,
    letterSpacing: 1.2,
    color: colors.ink,
  },
  rmAge: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  nowBadge: {
    backgroundColor: colors.blue,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  nowBadgeText: {
    ...enLabel,
    fontSize: 9,
    color: colors.white,
  },
  rmRev: {
    fontFamily: fonts.en,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 2,
  },
  rmNote: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 20,
    color: colors.mist,
    marginTop: 3,
  },
  section: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  secLabel: {
    ...enLabel,
    fontSize: 11,
    color: colors.mist,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  goalRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 5,
  },
  goalMark: {
    color: colors.blue,
    fontSize: 13,
    lineHeight: 22,
  },
  goalText: {
    flex: 1,
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  mvvHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  mvvEn: {
    ...enLabel,
    fontSize: 12,
    color: colors.blue,
  },
  mvvJp: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  mvvText: {
    fontFamily: fonts.jpMedium,
    fontSize: 14,
    lineHeight: 24,
    color: colors.ink,
    marginTop: 8,
  },
});
