/** 今日: 体重・体脂肪率・カロリー収支を主役に、スコアと記録を続けて表示 */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScoreRing } from '@/components/ScoreRing';
import { Card, Chip, SectionTitle } from '@/components/ui';
import { Colors, Fonts, Spacing, Type, scoreColor } from '@/constants/theme';
import { useDashboard, useHealthAuth } from '@/hooks/useHealthData';
import { currentTdee } from '@/lib/chat';
import { getCustomTags, addCustomTag } from '@/lib/db';
import { addDays } from '@/lib/dates';
import { formatKeyJa, todayKey } from '@/lib/dates';
import { formatValue, PRESET_TAGS } from '@/lib/metrics';
import { dailyIntake, localDateKey } from '@/lib/store';

const CATEGORIES = [
  { key: 'sleep' as const, label: '睡眠', color: Colors.sleep },
  { key: 'recovery' as const, label: '回復', color: Colors.recovery },
  { key: 'body' as const, label: '体組成', color: Colors.body },
  { key: 'activity' as const, label: '活動量', color: Colors.activity },
];

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { status, request } = useHealthAuth();
  const d = useDashboard();
  const [customTags, setCustomTags] = useState<{ name: string; emoji: string }[]>([]);
  const [cal, setCal] = useState<{ eaten: number; left: number | null } | null>(null);

  useEffect(() => {
    if (status != null && status !== 2) request().catch(() => {});
  }, [status, request]);

  useEffect(() => {
    getCustomTags().then(setCustomTags).catch(() => {});
  }, []);

  const loadCalories = useCallback(async () => {
    try {
      const now = new Date();
      const intake = await dailyIntake(addDays(now, -1).toISOString(), now.toISOString());
      const eaten = Math.round(intake.get(localDateKey(now.toISOString()))?.kcal ?? 0);
      const tdee = await currentTdee();
      setCal({ eaten, left: tdee.effective != null ? Math.round(tdee.effective - eaten) : null });
    } catch { /* 補助情報 */ }
  }, []);

  useFocusEffect(useCallback(() => { loadCalories(); }, [loadCalories]));

  const onTag = async (tag: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await d.toggleTag(tag);
  };

  const onAddCustomTag = () => {
    Alert.prompt('カスタムタグを追加', 'タグ名を入力(例: サウナ)', async (name) => {
      if (!name?.trim()) return;
      await addCustomTag(name.trim(), '🏷');
      setCustomTags(await getCustomTags());
    });
  };

  const allTags = [...PRESET_TAGS, ...customTags];
  const weight = d.today.weight;
  const bodyFat = d.today.body_fat ?? d.forecast?.current ?? null;

  // 空欄を並べない: データがある行だけ表示
  const statRows = ([
    ['sleep_total', '睡眠時間', ''],
    ['hrv', '睡眠時HRV', ' ms'],
    ['rhr', '安静時心拍', ' bpm'],
    ['steps', '歩数', ' 歩'],
    ['active_energy', '消費カロリー', ' kcal'],
    ['lean_mass', '筋肉量', ' kg'],
  ] as const).filter(([key]) => d.today[key] != null);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: 120, paddingHorizontal: Spacing.md }}
      refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={() => { d.refresh(); loadCalories(); }} tintColor={Colors.accent} />}
    >
      <Text style={styles.date}>{formatKeyJa(todayKey())}</Text>

      {/* 主役: 体重と体脂肪率 */}
      <View style={styles.heroRow}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>体重</Text>
          <Text style={styles.heroValue}>
            {weight != null ? formatValue('weight', weight) : '–'}
            <Text style={styles.heroUnit}> kg</Text>
          </Text>
        </Card>
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>体脂肪率</Text>
          <Text style={styles.heroValue}>
            {bodyFat != null ? formatValue('body_fat', bodyFat) : '–'}
            <Text style={styles.heroUnit}> %</Text>
          </Text>
          {d.forecast && d.forecast.diff > 0 && (
            <Text style={styles.heroSub}>目標まで {d.forecast.diff.toFixed(1)}%</Text>
          )}
          {d.forecast && d.forecast.diff <= 0 && (
            <Text style={[styles.heroSub, { color: Colors.good }]}>目標達成中</Text>
          )}
        </Card>
      </View>

      {/* 今日のカロリー */}
      <Card style={styles.calCard}>
        <View style={styles.calRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>今日食べた</Text>
            <Text style={styles.calValue}>
              {cal ? cal.eaten.toLocaleString() : '–'}
              <Text style={styles.heroUnit}> kcal</Text>
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.heroLabel}>今日あと</Text>
            <Text style={[styles.calValue, cal?.left != null && cal.left < 0 && { color: Colors.bad }]}>
              {cal?.left != null ? cal.left.toLocaleString() : '–'}
              <Text style={styles.heroUnit}> kcal</Text>
            </Text>
          </View>
        </View>
        {cal?.left == null && (
          <Text style={styles.calHint}>「あと何kcal」は設定タブで身長・生年月日を入れると出ます</Text>
        )}
      </Card>

      {/* 総合スコア */}
      <View style={styles.ringWrap}>
        <ScoreRing score={d.scores.total} />
      </View>

      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => {
          const v = d.scores[c.key];
          return (
            <Card key={c.key} style={styles.categoryCard}>
              <Text style={[styles.categoryValue, { color: scoreColor(v) }]}>{v ?? '–'}</Text>
              <View style={styles.categoryLabelRow}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Text style={styles.categoryLabel}>{c.label}</Text>
              </View>
            </Card>
          );
        })}
      </View>

      {/* 体調変化の兆候 */}
      {d.anomalies.length > 0 && (
        <>
          <SectionTitle>体調変化の兆候</SectionTitle>
          {d.anomalies.map((a) => (
            <Card key={a.metric} style={styles.anomalyCard}>
              <Text style={styles.anomalyTitle}>
                {a.z > 0 ? '↑' : '↓'} ベースラインから {Math.abs(a.z).toFixed(1)}σ の逸脱
              </Text>
              <Text style={styles.anomalyText}>{a.message}</Text>
            </Card>
          ))}
        </>
      )}

      {/* 今日の主要数値(データがあるものだけ) */}
      {statRows.length > 0 && (
        <>
          <SectionTitle>今日の記録</SectionTitle>
          <Card>
            {statRows.map(([key, label, unit], i) => (
              <View key={key} style={[styles.statRow, i > 0 && styles.statRowBorder]}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>
                  {formatValue(key, d.today[key])}
                  <Text style={styles.statUnit}>{unit}</Text>
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* タグ記録 */}
      <SectionTitle>今日のタグ</SectionTitle>
      <View style={styles.tagWrap}>
        {allTags.map((t) => (
          <Chip
            key={t.name}
            label={`${t.emoji} ${t.name}`}
            active={d.tags.includes(t.name)}
            onPress={() => onTag(t.name)}
          />
        ))}
        <Chip label="+ 追加" onPress={onAddCustomTag} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  date: { color: Colors.textSecondary, fontSize: Type.body, textAlign: 'center', marginBottom: Spacing.md },
  heroRow: { flexDirection: 'row', gap: Spacing.sm },
  heroCard: { flex: 1, paddingVertical: Spacing.md },
  heroLabel: { color: Colors.textSecondary, fontSize: Type.caption },
  heroValue: {
    color: Colors.text, fontSize: 40, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 4,
  },
  heroUnit: { fontSize: Type.body, color: Colors.textSecondary, fontWeight: '400' },
  heroSub: { color: Colors.accent, fontSize: Type.caption, marginTop: 4 },
  calCard: { marginTop: Spacing.sm },
  calRow: { flexDirection: 'row' },
  calValue: {
    color: Colors.text, fontSize: 30, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  calHint: { color: Colors.textFaint, fontSize: Type.caption, marginTop: Spacing.sm },
  ringWrap: { alignItems: 'center', marginVertical: Spacing.lg },
  categoryRow: { flexDirection: 'row', gap: Spacing.sm },
  categoryCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: 4 },
  categoryValue: {
    fontSize: Type.metric, fontFamily: Fonts.display, fontWeight: '700', fontVariant: ['tabular-nums'],
  },
  categoryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  categoryLabel: { color: Colors.textSecondary, fontSize: Type.caption },
  anomalyCard: { borderColor: Colors.warn, borderWidth: 1, marginBottom: Spacing.sm },
  anomalyTitle: { color: Colors.warn, fontSize: Type.label, fontWeight: '700', marginBottom: 4 },
  anomalyText: { color: Colors.text, fontSize: Type.body, lineHeight: 21 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  statRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  statLabel: { color: Colors.textSecondary, fontSize: Type.body },
  statValue: { color: Colors.text, fontSize: Type.body, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statUnit: { color: Colors.textFaint, fontSize: Type.caption, fontWeight: '400' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
