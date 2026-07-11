/** インサイト: 週次収支・実績TDEE・目標シミュレーター・記録一覧 (instructions v2 P0-2〜P0-4) */
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, SectionTitle } from '@/components/ui';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { currentTdee } from '@/lib/chat';
import { getSeries } from '@/lib/db';
import { addDays, toKey } from '@/lib/dates';
import {
  dailyIntake, deleteMealLog, deleteWorkoutLog, getProfile,
  listMealLogs, listWorkoutLogs, type MealLog, type WorkoutLog,
} from '@/lib/store';
import { computeBudget, type BudgetResult } from '@/utils/budget';
import { simulateGoal, type ScenarioResult } from '@/utils/simulator';
import type { TdeeResult } from '@/utils/tdee';

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const [tdee, setTdee] = useState<TdeeResult | null>(null);
  const [budget, setBudget] = useState<BudgetResult | null>(null);
  const [forecasts, setForecasts] = useState<{ label: string; target: number; sim: ScenarioResult }[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);

  const load = useCallback(async () => {
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
      const metric = g.metric === 'body_fat_pct' ? 'body_fat' : g.metric === 'weight' ? 'weight' : null;
      if (!metric) continue;
      const series = await getSeries(metric as never, toKey(addDays(today, -90)), toKey(today));
      fs.push({
        label: g.label ?? (g.metric === 'body_fat_pct' ? '体脂肪率' : '体重'),
        target: g.targetValue,
        sim: simulateGoal(series.map((s) => ({ date: s.date, value: s.value })), g.targetValue),
      });
    }
    setForecasts(fs);

    const from = addDays(today, -7);
    setMeals(await listMealLogs(from.toISOString(), today.toISOString()));
    setWorkouts(await listWorkoutLogs(from.toISOString(), today.toISOString()));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = (kind: 'meal' | 'workout', id: string) => {
    Alert.alert('削除', 'この記録を削除しますか?', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          if (kind === 'meal') await deleteMealLog(id); else await deleteWorkoutLog(id);
          load();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, padding: Spacing.md, paddingBottom: 120 }}
    >
      <Text style={styles.title}>インサイト</Text>

      <SectionTitle>今週の収支</SectionTitle>
      <Card>
        {budget ? (
          <>
            <View style={styles.row}>
              <Stat label="週予算" value={budget.budget.toLocaleString()} unit="kcal" />
              <Stat label="消費済み" value={budget.consumed.toLocaleString()} unit="kcal" />
            </View>
            <View style={[styles.row, { marginTop: Spacing.md }]}>
              <Stat
                label={`残り(${budget.daysLeft}日)`}
                value={budget.remaining.toLocaleString()}
                unit="kcal"
                accent={budget.remaining >= 0 ? Colors.good : Colors.bad}
              />
              <Stat label="日割り推奨" value={budget.perDayRecommended.toLocaleString()} unit="kcal/日" />
            </View>
            {budget.overPace && <Text style={styles.warn}>均等配分より速いペースで消費しています</Text>}
          </>
        ) : (
          <Text style={styles.muted}>
            TDEEの算出に身長・生年月日・体重データが必要です。設定タブでプロファイルを入力してください。
          </Text>
        )}
      </Card>

      <SectionTitle>実績TDEE(2系統)</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Stat label="活動ベース" value={tdee?.activity != null ? String(tdee.activity) : '—'} unit="kcal/日" />
          <Stat label="逆算ベース" value={tdee?.reverse != null ? String(tdee.reverse) : '—'} unit="kcal/日" />
        </View>
        {tdee?.reverse == null ? (
          <Text style={styles.muted}>
            逆算ベースは食事記録が14日分たまると有効になります(現在 {tdee?.loggedDays ?? 0}/14日)
          </Text>
        ) : tdee.activity != null ? (
          <Text style={styles.muted}>
            乖離 {Math.abs(tdee.activity - tdee.reverse)}kcal — 大きい場合は記録漏れか活動量推定のズレを示します
          </Text>
        ) : null}
      </Card>

      <SectionTitle>目標達成予測</SectionTitle>
      {forecasts.length === 0 ? (
        <Card>
          <Text style={styles.muted}>
            目標が未設定です。チャットで「体脂肪率15%を12月までに」のように話すか、設定タブから登録してください。
          </Text>
        </Card>
      ) : forecasts.map((f) => (
        <Card key={f.label} style={{ marginBottom: Spacing.sm }}>
          <Text style={styles.forecastTitle}>{f.label} → {f.target}</Text>
          {f.sim.median ? (
            <>
              <Text style={styles.forecastMain}>{fmtDate(f.sim.median)} 到達見込み</Text>
              <Text style={styles.muted}>
                楽観 {fmtDate(f.sim.optimistic)} / 悲観 {fmtDate(f.sim.pessimistic)}
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>現在のトレンドが目標方向に進んでいないため予測できません</Text>
          )}
        </Card>
      ))}

      <SectionTitle>直近7日の記録</SectionTitle>
      {meals.length === 0 && workouts.length === 0 && (
        <Card>
          <Text style={styles.muted}>
            まだ記録がありません。チャットから「昼はサラダチキンとおにぎり」のように話しかけてください。
          </Text>
        </Card>
      )}
      {meals.map((m) => (
        <Pressable key={m.id} onLongPress={() => confirmDelete('meal', m.id)}>
          <Card style={styles.logRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logTitle}>
                🍽 {m.freeText ?? 'テンプレート食'}{m.isEstimate ? <Text style={styles.est}> 概算</Text> : null}
              </Text>
              <Text style={styles.logSub}>{fmtDateTime(m.timestamp)}</Text>
            </View>
            <Text style={styles.logValue}>{Math.round(m.kcal)}kcal</Text>
          </Card>
        </Pressable>
      ))}
      {workouts.map((w) => (
        <Pressable key={w.id} onLongPress={() => confirmDelete('workout', w.id)}>
          <Card style={styles.logRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logTitle}>
                🏋️ {w.exercises.map((e) => e.exerciseName).join('・') || 'トレーニング'}
              </Text>
              <Text style={styles.logSub}>{fmtDateTime(w.timestamp)}</Text>
            </View>
            <Text style={styles.logValue}>{w.exercises.reduce((a, e) => a + e.sets, 0)}set</Text>
          </Card>
        </Pressable>
      ))}
      {(meals.length > 0 || workouts.length > 0) && (
        <Text style={styles.hint}>長押しで記録を削除できます</Text>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>
        {value}<Text style={styles.statUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: Type.title, fontFamily: Fonts.sans, fontWeight: '700' },
  row: { flexDirection: 'row', gap: Spacing.md },
  statLabel: { color: Colors.textSecondary, fontSize: Type.caption },
  statValue: { color: Colors.text, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 2 },
  statUnit: { color: Colors.textSecondary, fontSize: Type.caption, fontWeight: '400' },
  muted: { color: Colors.textSecondary, fontSize: Type.caption, lineHeight: 18, marginTop: Spacing.sm },
  warn: { color: Colors.warn, fontSize: Type.caption, marginTop: Spacing.sm },
  forecastTitle: { color: Colors.textSecondary, fontSize: Type.caption },
  forecastMain: { color: Colors.text, fontSize: 20, fontWeight: '700', marginTop: 4 },
  logRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  logTitle: { color: Colors.text, fontSize: Type.body },
  logSub: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 2 },
  logValue: { color: Colors.textSecondary, fontSize: Type.body, fontVariant: ['tabular-nums'] },
  est: { color: Colors.warn, fontSize: Type.caption },
  hint: { color: Colors.textFaint, fontSize: Type.caption, textAlign: 'center', marginTop: Spacing.md },
});
