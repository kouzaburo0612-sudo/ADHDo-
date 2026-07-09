/** ホーム(Today): 総合スコア・カテゴリ別スコア・目標・異常検知・タグ記録 */
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScoreRing } from '@/components/ScoreRing';
import { Card, Chip, SectionTitle } from '@/components/ui';
import { Colors, Fonts, Spacing, Type, scoreColor } from '@/constants/theme';
import { useDashboard, useHealthAuth } from '@/hooks/useHealthData';
import { getCustomTags, addCustomTag } from '@/lib/db';
import { formatKeyJa, todayKey } from '@/lib/dates';
import { formatValue, PRESET_TAGS } from '@/lib/metrics';

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

  useEffect(() => {
    // 未リクエストならHealthKit許可ダイアログを出す (2 = unnecessary/取得済み)
    if (status != null && status !== 2) request().catch(() => {});
  }, [status, request]);

  useEffect(() => {
    getCustomTags().then(setCustomTags).catch(() => {});
  }, []);

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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: 120, paddingHorizontal: Spacing.md }}
      refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={d.refresh} tintColor={Colors.accent} />}
    >
      <Text style={styles.date}>{formatKeyJa(todayKey())}</Text>

      <View style={styles.ringWrap}>
        <ScoreRing score={d.scores.total} />
      </View>

      {/* カテゴリ別スコア */}
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

      {/* 体脂肪率トラッキング */}
      <SectionTitle>体脂肪率</SectionTitle>
      <Card>
        {d.forecast ? (
          <>
            <View style={styles.bfRow}>
              <View>
                <Text style={styles.bfValue}>
                  {formatValue('body_fat', d.forecast.current)}
                  <Text style={styles.bfUnit}> %</Text>
                </Text>
                <Text style={styles.bfLabel}>現在</Text>
              </View>
              <View style={styles.bfRight}>
                <Text style={[styles.bfDiff, { color: d.forecast.diff <= 0 ? Colors.good : Colors.textSecondary }]}>
                  {d.forecast.diff <= 0
                    ? '目標達成中'
                    : `目標まで ${d.forecast.diff.toFixed(1)}%`}
                </Text>
                <Text style={styles.bfGoal}>目標 {d.settings.bodyFatGoal}%</Text>
              </View>
            </View>
            {d.forecast.date && (
              <Text style={styles.bfForecast}>
                直近30日のペースなら {formatKeyJa(d.forecast.date)} ごろに到達見込み
              </Text>
            )}
            {d.forecast.date == null && d.forecast.diff > 0 && (
              <Text style={styles.bfForecastMuted}>
                直近30日は横ばい。このペースだと到達日は予測できません
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>体脂肪率のデータがまだありません。Withingsで測定するとここに表示されます。</Text>
        )}
      </Card>

      {/* 今日の主要数値 */}
      <SectionTitle>今日の記録</SectionTitle>
      <Card>
        {([
          ['sleep_total', '睡眠時間', ''],
          ['hrv', '睡眠時HRV', ' ms'],
          ['rhr', '安静時心拍', ' bpm'],
          ['steps', '歩数', ' 歩'],
          ['weight', '体重', ' kg'],
        ] as const).map(([key, label, unit], i) => (
          <View key={key} style={[styles.statRow, i > 0 && styles.statRowBorder]}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>
              {formatValue(key, d.today[key])}
              {d.today[key] != null && <Text style={styles.statUnit}>{unit}</Text>}
            </Text>
          </View>
        ))}
      </Card>

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
  date: { color: Colors.textSecondary, fontSize: Type.body, textAlign: 'center' },
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
  bfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bfValue: { fontSize: Type.display, fontFamily: Fonts.display, fontWeight: '700', fontVariant: ['tabular-nums'], color: Colors.text },
  bfUnit: { fontSize: Type.body, color: Colors.textSecondary },
  bfLabel: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 2 },
  bfRight: { alignItems: 'flex-end' },
  bfDiff: { fontSize: Type.body, fontWeight: '600' },
  bfGoal: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 4 },
  bfForecast: { color: Colors.accent, fontSize: Type.body, marginTop: Spacing.md },
  bfForecastMuted: { color: Colors.textFaint, fontSize: Type.body, marginTop: Spacing.md },
  emptyText: { color: Colors.textFaint, fontSize: Type.body, lineHeight: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  statRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  statLabel: { color: Colors.textSecondary, fontSize: Type.body },
  statValue: { color: Colors.text, fontSize: Type.body, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statUnit: { color: Colors.textFaint, fontSize: Type.caption, fontWeight: '400' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
