/** トレンド(History): 日/週/月/年切替・過去参照・比較ビュー・タグ相関 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TrendChart } from '@/components/TrendChart';
import { Card, Chip, SectionTitle, Segmented } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { RANGE_DAYS, useComparison, useSeries, useTagEffects, type RangeMode } from '@/hooks/useHealthData';
import { useFocusEffect } from 'expo-router';
import { addDays, formatKeyJa, fromKey, toKey, todayKey } from '@/lib/dates';
import { currentTdee } from '@/lib/chat';
import { getSeries } from '@/lib/db';
import { dailyIntake, getProfile } from '@/lib/store';
import { computeBudget, type BudgetResult } from '@/utils/budget';
import { simulateGoal, type ScenarioResult } from '@/utils/simulator';
import type { TdeeResult } from '@/utils/tdee';
import { formatValue, METRIC_ORDER, METRICS, type MetricKey } from '@/lib/metrics';

const MODES: { value: RangeMode; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [metric, setMetric] = useState<MetricKey>('body_fat');
  const [mode, setMode] = useState<RangeMode>('day');
  const [anchor, setAnchor] = useState(todayKey());
  const [pickerOpen, setPickerOpen] = useState(false);

  const [tdee, setTdee] = useState<TdeeResult | null>(null);
  const [budget, setBudget] = useState<BudgetResult | null>(null);
  const [forecasts, setForecasts] = useState<{ label: string; target: number; sim: ScenarioResult }[]>([]);

  const loadInsights = useCallback(async () => {
    try {
      const today = new Date();
      const t = await currentTdee();
      setTdee(t);
      const intake = await dailyIntake(addDays(today, -8).toISOString(), today.toISOString());
      setBudget(t.effective != null
        ? computeBudget({
            tdee: t.effective, weekStart: 1, today,
            intakeByDate: new Map([...intake].map(([k, v]) => [k, v.kcal])),
            weeklyDeficitTarget: 0,
          })
        : null);
      const profile = await getProfile();
      const fs: { label: string; target: number; sim: ScenarioResult }[] = [];
      for (const g of profile.goals) {
        const m = g.metric === 'body_fat_pct' ? 'body_fat' : g.metric === 'weight' ? 'weight' : null;
        if (!m) continue;
        const series = await getSeries(m as never, toKey(addDays(today, -90)), toKey(today));
        fs.push({
          label: g.label ?? (g.metric === 'body_fat_pct' ? '体脂肪率' : '体重'),
          target: g.targetValue,
          sim: simulateGoal(series.map((p) => ({ date: p.date, value: p.value })), g.targetValue),
        });
      }
      setForecasts(fs);
    } catch { /* 補助情報 */ }
  }, []);

  useFocusEffect(useCallback(() => { loadInsights(); }, [loadInsights]));

  const { points } = useSeries(metric, mode, anchor);
  const compare = useComparison(metric);
  const tagEffects = useTagEffects();
  const def = METRICS[metric];

  const shiftWindow = (dir: 1 | -1) => {
    const next = toKey(addDays(fromKey(anchor), dir * RANGE_DAYS[mode]));
    setAnchor(next > todayKey() ? todayKey() : next);
  };

  // グラフを左右スワイプで期間移動(過去へ即座に遡れることが最重要)
  const swipe = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-24, 24])
      .failOffsetY([-16, 16])
      .onEnd((e) => {
        'worklet';
        if (e.translationX > 48) runOnJS(shiftWindow)(-1);
        else if (e.translationX < -48) runOnJS(shiftWindow)(1);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor, mode],
  );

  const windowStart = toKey(addDays(fromKey(anchor), -(RANGE_DAYS[mode] - 1)));
  const latest = points.length > 0 ? points[points.length - 1] : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: 120, paddingHorizontal: Spacing.md }}
    >
      {/* 目標達成予測 */}
      {forecasts.map((f) => (
        <Card key={f.label} style={styles.goalCard}>
          <Text style={styles.goalLabel}>{f.label} {f.target} まで</Text>
          {f.sim.median ? (
            <>
              <Text style={styles.goalMain}>{fmtShortDate(f.sim.median)} 到達見込み</Text>
              <Text style={styles.goalSub}>順調なら {fmtShortDate(f.sim.optimistic)} ・ 停滞すると {fmtShortDate(f.sim.pessimistic)}</Text>
            </>
          ) : (
            <Text style={styles.goalSub}>直近のトレンドが目標方向でないため予測できません</Text>
          )}
        </Card>
      ))}

      {/* 週次収支(週単位はこのページで見る) */}
      {budget && (
        <Card style={styles.goalCard}>
          <Text style={styles.goalLabel}>今週のカロリー収支(月曜はじまり)</Text>
          <View style={styles.budgetRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.budgetNum}>{budget.remaining.toLocaleString()}</Text>
              <Text style={styles.budgetCap}>残り kcal</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.budgetNum}>{budget.perDayRecommended.toLocaleString()}</Text>
              <Text style={styles.budgetCap}>日割り推奨 kcal</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.budgetNum}>{tdee?.effective ?? '–'}</Text>
              <Text style={styles.budgetCap}>実績TDEE kcal/日</Text>
            </View>
          </View>
        </Card>
      )}

      {/* 指標セレクタ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricRow}>
        {METRIC_ORDER.map((k) => (
          <Chip key={k} label={METRICS[k].label} active={k === metric} onPress={() => setMetric(k)} />
        ))}
      </ScrollView>

      <View style={{ marginTop: Spacing.md }}>
        <Segmented options={MODES} value={mode} onChange={setMode} />
      </View>

      {/* 期間ナビゲーション */}
      <View style={styles.navRow}>
        <Pressable onPress={() => shiftWindow(-1)} hitSlop={8} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setPickerOpen(true)} hitSlop={8}>
          <Text style={styles.rangeText}>{formatKeyJa(windowStart)} 〜 {formatKeyJa(anchor)}</Text>
        </Pressable>
        <Pressable
          onPress={() => shiftWindow(1)}
          hitSlop={8}
          style={[styles.navBtn, anchor >= todayKey() && { opacity: 0.3 }]}
        >
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      {pickerOpen && (
        <DateTimePicker
          value={fromKey(anchor)}
          mode="date"
          display="inline"
          maximumDate={new Date()}
          themeVariant="dark"
          accentColor={Colors.accent}
          onChange={(event, date) => {
            setPickerOpen(false);
            if (event.type === 'set' && date) setAnchor(toKey(date));
          }}
        />
      )}

      {/* グラフ */}
      <Card style={{ marginTop: Spacing.sm }}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{def.label}</Text>
          {latest && (
            <Text style={styles.chartLatest}>
              {formatValue(metric, latest.value)}
              <Text style={styles.chartUnit}> {def.asDuration ? '' : def.unit}</Text>
            </Text>
          )}
        </View>
        <GestureDetector gesture={swipe}>
          <View>
            <TrendChart points={points} metric={metric} />
          </View>
        </GestureDetector>
      </Card>

      {/* 比較ビュー */}
      <SectionTitle>比較</SectionTitle>
      <Card>
        <View style={styles.compareRow}>
          {(['今日', '1ヶ月前', '1年前'] as const).map((label, i) => (
            <View key={label} style={styles.compareCol}>
              <Text style={styles.compareValue}>
                {formatValue(metric, compare[i])}
              </Text>
              <Text style={styles.compareLabel}>{label}</Text>
            </View>
          ))}
        </View>
        {compare[0] != null && compare[1] != null && (
          <Text style={styles.compareDelta}>
            1ヶ月で {formatDelta(metric, compare[0] - compare[1])}
            {compare[2] != null && ` / 1年で ${formatDelta(metric, compare[0] - compare[2])}`}
          </Text>
        )}
      </Card>

      {/* タグ相関分析 */}
      <SectionTitle>タグの影響(翌日の平均変化)</SectionTitle>
      {tagEffects.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            タグが3回以上記録されると、翌日の指標変化がここに集計されます。
          </Text>
        </Card>
      ) : (
        tagEffects.map((t) => (
          <Card key={t.tag} style={{ marginBottom: Spacing.sm }}>
            <Text style={styles.tagTitle}>{t.tag} 翌日 <Text style={styles.tagCount}>({t.count}回)</Text></Text>
            <Text style={styles.tagEffects}>{t.effects.map((e) => e.formatted).join(' / ')}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function formatDelta(metric: MetricKey, delta: number): string {
  const sign = delta >= 0 ? '+' : '−';
  const def = METRICS[metric];
  const abs = formatValue(metric, Math.abs(delta));
  return `${sign}${abs}${def.asDuration ? '' : def.unit}`;
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  goalCard: { marginBottom: Spacing.sm },
  goalLabel: { color: Colors.textSecondary, fontSize: Type.caption },
  goalMain: { color: Colors.text, fontSize: 22, fontWeight: '700', marginTop: 4 },
  goalSub: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 4 },
  budgetRow: { flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.sm },
  budgetNum: { color: Colors.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  budgetCap: { color: Colors.textFaint, fontSize: 11, marginTop: 2 },
  screen: { flex: 1, backgroundColor: Colors.bg },
  metricRow: { flexDirection: 'row', gap: Spacing.sm },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnText: { color: Colors.text, fontSize: 22, lineHeight: 24 },
  rangeText: { color: Colors.accent, fontSize: Type.body, fontWeight: '600' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing.sm },
  chartTitle: { color: Colors.textSecondary, fontSize: Type.body },
  chartLatest: { color: Colors.text, fontSize: Type.metric, fontFamily: Fonts.display, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chartUnit: { fontSize: Type.caption, color: Colors.textFaint },
  compareRow: { flexDirection: 'row' },
  compareCol: { flex: 1, alignItems: 'center' },
  compareValue: { color: Colors.text, fontSize: Type.metric, fontFamily: Fonts.display, fontWeight: '700', fontVariant: ['tabular-nums'] },
  compareLabel: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 4 },
  compareDelta: { color: Colors.textSecondary, fontSize: Type.label, textAlign: 'center', marginTop: Spacing.md },
  emptyText: { color: Colors.textFaint, fontSize: Type.body, lineHeight: 20 },
  tagTitle: { color: Colors.text, fontSize: Type.body, fontWeight: '600', marginBottom: 4 },
  tagCount: { color: Colors.textFaint, fontWeight: '400', fontSize: Type.caption },
  tagEffects: { color: Colors.textSecondary, fontSize: Type.body, lineHeight: 21 },
});
