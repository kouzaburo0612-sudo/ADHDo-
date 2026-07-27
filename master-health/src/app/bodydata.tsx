/**
 * Body Data: 全デバイス(Oura / Withings / Apple Watch / ヘルスケア)のデータを
 * 系統別(体組成・心血管・睡眠・活動・リカバリー)に整理した統合データベース画面。
 * - 各指標カード: 最新値+前回比矢印+30日ミニトレンド。タップで期間切替の拡大グラフ
 * - データがない指標は非表示(新デバイス接続で自動的にカードが増える)
 * - Oura独自スコアはAPI直接連携(Moreの設定でトークン入力)
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { TrendChart } from '@/components/TrendChart';
import { Card, SectionTitle, Segmented } from '@/components/ui';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useSeries, type RangeMode } from '@/hooks/useHealthData';
import { getSeries, type MetricRow } from '@/lib/db';
import { addDays, formatKeyJa, toKey, todayKey } from '@/lib/dates';
import { METRICS, formatValue, type MetricKey } from '@/lib/metrics';
import { getOuraToken } from '@/lib/oura';
import { listStressLogs, listWorkoutLogs, localDateKey, type StressLog, type WorkoutLog } from '@/lib/store';
import { syncHealthData } from '@/lib/sync';

/** 系統別カテゴリ定義。順序は指示どおり 体組成→心血管→睡眠→活動→リカバリー */
const CATEGORIES: { emoji: string; title: string; metrics: MetricKey[] }[] = [
  { emoji: '🏋️', title: '体組成', metrics: ['weight', 'body_fat', 'lean_mass', 'bmi'] },
  { emoji: '❤️', title: '心血管', metrics: ['rhr', 'hrv', 'heart_rate', 'walking_hr', 'vo2max'] },
  { emoji: '😴', title: '睡眠', metrics: ['oura_sleep_score', 'sleep_total', 'sleep_deep', 'sleep_rem', 'sleep_core'] },
  { emoji: '🔥', title: '活動', metrics: ['oura_activity_score', 'steps', 'active_energy', 'workout_energy', 'exercise_time', 'distance', 'flights'] },
  { emoji: '🧠', title: 'リカバリー', metrics: ['oura_readiness', 'temp_deviation', 'wrist_temp', 'resp_rate', 'spo2', 'basal_energy'] },
];

/** Oura API直接取得の指標(ソースバッジ表示用) */
const OURA_METRICS = new Set<MetricKey>(['oura_readiness', 'oura_sleep_score', 'oura_activity_score', 'temp_deviation']);

const MODES: { value: RangeMode; label: string }[] = [
  { value: 'day', label: '月' },
  { value: 'week', label: '半年' },
  { value: 'month', label: '年' },
  { value: 'year', label: '全期間' },
];

export default function BodyDataScreen() {
  const [series, setSeries] = useState<Map<MetricKey, MetricRow[]>>(new Map());
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [stress, setStress] = useState<StressLog[]>([]);
  const [ouraConnected, setOuraConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<MetricKey | null>(null);

  const load = useCallback(async () => {
    try {
      const today = new Date();
      const from = toKey(addDays(today, -30));
      const to = todayKey();
      const map = new Map<MetricKey, MetricRow[]>();
      const all = CATEGORIES.flatMap((c) => c.metrics);
      await Promise.all(all.map(async (k) => {
        const s = await getSeries(k, from, to);
        if (s.length > 0) map.set(k, s);
      }));
      setSeries(map);
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      setWorkouts(await listWorkoutLogs(addDays(today, -7).toISOString(), dayEnd.toISOString()).catch(() => []));
      setStress(await listStressLogs(addDays(today, -7).toISOString(), dayEnd.toISOString()).catch(() => []));
      setOuraConnected((await getOuraToken()) != null);
    } catch { /* 次のフォーカスで再試行 */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await syncHealthData(); } catch { /* 権限なし等 */ }
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <AppHeader sub="Body Data ・ 全デバイス統合" />
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {CATEGORIES.map((cat) => {
          const present = cat.metrics.filter((k) => series.has(k));
          const isSleep = cat.title === '睡眠';
          const isActivity = cat.title === '活動';
          const isRecovery = cat.title === 'リカバリー';
          if (present.length === 0 && !(isActivity && workouts.length > 0) && !(isRecovery && stress.length > 0)) return null;
          return (
            <View key={cat.title}>
              <SectionTitle>{`${cat.emoji} ${cat.title}`}</SectionTitle>
              {present.map((k) => (
                <MetricCard key={k} metric={k} rows={series.get(k)!} onPress={() => setDetail(k)} />
              ))}
              {isSleep && series.has('sleep_total') && (
                <SleepHeatmap rows={series.get('sleep_total')!} />
              )}
              {isActivity && workouts.length > 0 && (
                <Card style={{ marginBottom: Spacing.sm }}>
                  <Text style={styles.subTitle}>直近7日のワークアウト(アプリ内記録)</Text>
                  {workouts.map((w) => (
                    <View key={w.id} style={styles.logRow}>
                      <Text style={styles.logDate}>{formatKeyJa(localDateKey(w.timestamp))}</Text>
                      <Text style={styles.logText} numberOfLines={1}>
                        {w.exercises.map((e) => e.exerciseName).join('・') || 'トレーニング'}
                        {w.durationMin != null ? ` ・ ${Math.round(w.durationMin)}分` : ''}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
              {isRecovery && stress.length > 0 && (
                <Card style={{ marginBottom: Spacing.sm }}>
                  <Text style={styles.subTitle}>直近7日のストレス報告(アプリ内記録)</Text>
                  {stress.map((s) => (
                    <View key={s.id} style={styles.logRow}>
                      <Text style={styles.logDate}>{formatKeyJa(localDateKey(s.timestamp))}</Text>
                      <Text style={styles.logText}>
                        {['', '😌 快調', '🙂 ふつう', '😥 やや疲れ', '😰 つらい', '🤯 限界'][s.level] ?? s.level}
                        {s.note ? `(${s.note})` : ''}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
            </View>
          );
        })}

        {!ouraConnected && (
          <Card style={{ marginTop: Spacing.sm }}>
            <Text style={styles.hint}>
              💍 Ouraのレディネス・睡眠・アクティビティスコアを表示するには、
              More → 設定 → Oura連携 でPersonal Access Tokenを設定してください
              (体表温偏差も取得されます)
            </Text>
          </Card>
        )}
        <Text style={styles.hint}>
          データがまだない指標は表示されません。新しいデバイスをヘルスケアに接続すると自動でカードが増えます。
          複数デバイスの同一指標は、iOSヘルスケアアプリの「データソースの優先順位」設定に従って統合されます
        </Text>
      </ScrollView>

      {/* 拡大グラフ(期間切替) */}
      <DetailModal metric={detail} onClose={() => setDetail(null)} />
    </View>
  );
}

/** 指標カード: 最新値+前回比矢印+30日ミニトレンド */
function MetricCard({ metric, rows, onPress }: { metric: MetricKey; rows: MetricRow[]; onPress: () => void }) {
  const def = METRICS[metric];
  const latest = rows[rows.length - 1];
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
  const diff = prev != null ? latest.value - prev.value : null;

  let arrow = '';
  let arrowColor: string = Colors.textFaint;
  if (diff != null && Math.abs(diff) > 1e-9) {
    arrow = diff > 0 ? '▲' : '▼';
    if (def.higherIsBetter != null) {
      const improving = (diff > 0) === def.higherIsBetter;
      arrowColor = improving ? Colors.good : Colors.warn;
    }
  }

  // 30日ミニトレンド(min-max正規化の細いバー)
  const spark = useMemo(() => {
    const vals = rows.map((r) => r.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return rows.slice(-30).map((r) => 0.15 + 0.85 * ((r.value - min) / range));
  }, [rows]);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.metricCard}>
        <View style={{ flex: 1 }}>
          <View style={styles.metricHead}>
            <Text style={styles.metricLabel}>{def.label}</Text>
            {OURA_METRICS.has(metric) && (
              <View style={styles.srcBadge}><Text style={styles.srcBadgeText}>Oura</Text></View>
            )}
          </View>
          <Text style={styles.metricValue}>
            {formatValue(metric, latest.value)}
            <Text style={styles.metricUnit}>{def.asDuration ? '' : ` ${def.unit}`}</Text>
            {arrow !== '' && (
              <Text style={[styles.metricDiff, { color: arrowColor }]}>
                {'  '}{arrow} {formatValue(metric, Math.abs(diff!))}
              </Text>
            )}
          </Text>
          <Text style={styles.metricSub}>{formatKeyJa(latest.date)}時点 ・ タップで期間別グラフ</Text>
        </View>
        <View style={styles.sparkWrap}>
          {spark.map((h, i) => (
            <View key={i} style={[styles.sparkBar, { height: 34 * h }]} />
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

/** 週間睡眠リズムのカレンダーヒートマップ(直近4週) */
function SleepHeatmap({ rows }: { rows: MetricRow[] }) {
  const byDate = useMemo(() => new Map(rows.map((r) => [r.date, r.value])), [rows]);
  const today = new Date();
  // 直近28日を月曜始まりの4週グリッドに
  const start = addDays(today, -27);
  const cells: { key: string; v: number | null }[] = [];
  for (let i = 0; i < 28; i++) {
    const k = toKey(addDays(start, i));
    cells.push({ key: k, v: byDate.get(k) ?? null });
  }
  const color = (v: number | null): string => {
    if (v == null) return Colors.surfaceRaised;
    const h = v / 60;
    if (h >= 7.5) return Colors.accent;
    if (h >= 6.5) return Colors.accentDim;
    if (h >= 5) return '#7A5A28';
    return '#5C2320';
  };
  return (
    <Card style={{ marginBottom: Spacing.sm }}>
      <Text style={styles.subTitle}>睡眠リズム(直近4週・色=睡眠時間)</Text>
      <View style={styles.heatGrid}>
        {cells.map((c) => (
          <View key={c.key} style={[styles.heatCell, { backgroundColor: color(c.v) }]} />
        ))}
      </View>
      <View style={styles.heatLegend}>
        <Text style={styles.hint}>■ 7.5h+ </Text>
        <Text style={[styles.hint, { color: Colors.accentDim }]}>■ 6.5h+ </Text>
        <Text style={[styles.hint, { color: '#7A5A28' }]}>■ 5h+ </Text>
        <Text style={[styles.hint, { color: '#5C2320' }]}>■ 5h未満</Text>
      </View>
    </Card>
  );
}

/** 拡大グラフモーダル(期間切替: 月/半年/年/全期間) */
function DetailModal({ metric, onClose }: { metric: MetricKey | null; onClose: () => void }) {
  const [mode, setMode] = useState<RangeMode>('day');
  const { points } = useSeries(metric ?? 'weight', mode, todayKey());
  if (metric == null) {
    return null;
  }
  const def = METRICS[metric];
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{def.label}</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.modalClose}>閉じる</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}>
          <Segmented options={MODES} value={mode} onChange={setMode} />
          <Card style={{ marginTop: Spacing.md }}>
            <TrendChart points={points} metric={metric} height={260} />
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  metricCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricLabel: { color: Colors.textSecondary, fontSize: Type.caption },
  metricValue: {
    color: Colors.text, fontSize: 26, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  metricUnit: { fontSize: Type.caption, color: Colors.textSecondary, fontWeight: '400' },
  metricDiff: { fontSize: Type.caption, fontWeight: '700' },
  metricSub: { color: Colors.textFaint, fontSize: Type.label, marginTop: 2 },
  srcBadge: { backgroundColor: Colors.accentDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  srcBadgeText: { color: Colors.accent, fontSize: 10, fontWeight: '700' },
  sparkWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, height: 36, width: 96 },
  sparkBar: { flex: 1, backgroundColor: Colors.accentDim, borderRadius: 1 },
  subTitle: { color: Colors.textSecondary, fontSize: Type.caption, fontWeight: '700', marginBottom: 6 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  logDate: { color: Colors.textFaint, fontSize: Type.caption, width: 64 },
  logText: { color: Colors.text, fontSize: Type.caption, flex: 1 },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: '12.7%', aspectRatio: 1.6, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', marginTop: 6 },
  hint: { color: Colors.textFaint, fontSize: Type.label, lineHeight: 15, marginTop: 6 },
  modalRoot: { flex: 1, backgroundColor: Colors.bg },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  modalClose: { color: Colors.textSecondary, fontSize: Type.body },
});
