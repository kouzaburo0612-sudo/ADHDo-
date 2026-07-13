/** トレンド(History): 目標設定・日次収支・達成予測・指標グラフ・比較・タグ相関 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

import { AppHeader } from '@/components/AppHeader';
import { GoalEditModal } from '@/components/GoalEditModal';
import { TrendChart } from '@/components/TrendChart';
import { Card, Chip, SectionTitle, Segmented } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { RANGE_DAYS, useComparison, useSeries, useTagEffects, type RangeMode } from '@/hooks/useHealthData';
import { useFocusEffect } from 'expo-router';
import { addDays, formatKeyJa, fromKey, toKey, todayKey } from '@/lib/dates';
import { currentTdee } from '@/lib/chat';
import { dailyIntake, getProfile, newId, saveGoalPlan, saveProfile, type GoalPlan } from '@/lib/store';
import { computeBudget, type BudgetResult } from '@/utils/budget';
import { balanceSeries, goalNumbers, type DayBalance, type GoalNumbers } from '@/utils/deficit';
import { planForecast, type PlanForecast } from '@/utils/forecast';
import type { TdeeResult } from '@/utils/tdee';
import { formatValue, METRIC_ORDER, METRICS, type MetricKey } from '@/lib/metrics';

const MODES: { value: RangeMode; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

export default function HistoryScreen() {
  const [metric, setMetric] = useState<MetricKey>('body_fat');
  const [mode, setMode] = useState<RangeMode>('day');
  const [anchor, setAnchor] = useState(todayKey());
  const [pickerOpen, setPickerOpen] = useState(false);

  const [tdee, setTdee] = useState<TdeeResult | null>(null);
  const [budget, setBudget] = useState<BudgetResult | null>(null);
  const [pf, setPf] = useState<PlanForecast | null>(null);
  const [goal, setGoal] = useState<GoalNumbers | null>(null);
  const [balances, setBalances] = useState<DayBalance[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  const loadInsights = useCallback(async () => {
    try {
      const today = new Date();
      setGoal(await goalNumbers());
      setBalances(await balanceSeries(14));
      setPf(await planForecast());
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
    } catch { /* 補助情報 */ }
  }, []);

  useFocusEffect(useCallback(() => { loadInsights(); }, [loadInsights]));

  const saveGoal = useCallback(async (plan: GoalPlan) => {
    await saveGoalPlan(plan);
    // AIチャットからも見えるよう、プロファイルの目標にも同期する
    if (plan.targetDate) {
      const profile = await getProfile();
      const goals = profile.goals.filter((g) => g.metric !== 'weight' && g.metric !== 'body_fat_pct');
      if (plan.targetWeightKg != null) {
        goals.push({ id: newId(), metric: 'weight', label: '体重', targetValue: plan.targetWeightKg, deadline: plan.targetDate });
      }
      if (plan.targetBodyFatPct != null) {
        goals.push({ id: newId(), metric: 'body_fat_pct', label: '体脂肪率', targetValue: plan.targetBodyFatPct, deadline: plan.targetDate });
      }
      await saveProfile({ ...profile, goals });
    }
    setEditOpen(false);
    loadInsights();
  }, [loadInsights]);

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
    <View style={styles.screen}>
    <AppHeader sub="トレンド" />
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: 120, paddingHorizontal: Spacing.md }}
    >

      {/* 目標設定(カロミル風) */}
      <Card style={styles.goalCard}>
        <View style={styles.goalHead}>
          <Text style={styles.goalLabel}>目標設定</Text>
          <Pressable onPress={() => setEditOpen(true)} hitSlop={8}>
            <Text style={styles.editLink}>{goal?.plan.targetWeightKg != null ? '変更 ›' : '設定する ›'}</Text>
          </Pressable>
        </View>
        {goal != null && (goal.plan.targetBodyFatPct != null || goal.plan.targetWeightKg != null) ? (
          <>
            {goal.plan.priority === 'body_fat' && goal.plan.targetBodyFatPct != null ? (
              <View style={styles.goalWeights}>
                <Text style={styles.goalNow}>
                  {goal.currentBodyFatPct != null ? goal.currentBodyFatPct.toFixed(1) : '–'}
                  <Text style={styles.goalUnit}> %</Text>
                </Text>
                <Text style={styles.goalArrow}>→</Text>
                <Text style={styles.goalTargetNum}>
                  {goal.plan.targetBodyFatPct.toFixed(1)}
                  <Text style={styles.goalUnit}> %</Text>
                </Text>
                {goal.plan.targetWeightKg != null && (
                  <Text style={styles.goalSubMetric}>
                    体重 {goal.currentWeightKg?.toFixed(1) ?? '–'} → {goal.plan.targetWeightKg}kg
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.goalWeights}>
                <Text style={styles.goalNow}>
                  {goal.currentWeightKg != null ? goal.currentWeightKg.toFixed(1) : '–'}
                  <Text style={styles.goalUnit}> kg</Text>
                </Text>
                <Text style={styles.goalArrow}>→</Text>
                <Text style={styles.goalTargetNum}>
                  {goal.plan.targetWeightKg?.toFixed(1) ?? '–'}
                  <Text style={styles.goalUnit}> kg</Text>
                </Text>
              </View>
            )}
            <View style={styles.goalGrid}>
              {goal.remainingKg != null && <GoalStat label="落とす脂肪" value={`${goal.remainingKg}kg`} />}
              {goal.daysLeft != null && <GoalStat label="期限まで" value={`${goal.daysLeft}日`} />}
              {goal.paceKgPerWeek != null && <GoalStat label="必要ペース" value={`${goal.paceKgPerWeek}kg/週`} />}
              {goal.requiredDailyDeficit != null && <GoalStat label="必要赤字" value={`${goal.requiredDailyDeficit}kcal/日`} />}
            </View>
            {goal.targetIntakeKcal != null && (
              <View style={styles.intakeRow}>
                <Text style={styles.intakeMain}>目標摂取 {goal.targetIntakeKcal.toLocaleString()} kcal/日</Text>
                {goal.pfcGrams && (
                  <Text style={styles.intakeSub}>P {goal.pfcGrams.p}g ・ F {goal.pfcGrams.f}g ・ C {goal.pfcGrams.c}g</Text>
                )}
                {goal.plan.intakeMode === 'auto' && goal.avgBurn != null && goal.requiredDailyDeficit != null && (
                  <Text style={styles.intakeFormula}>
                    計算式: 実績消費 {goal.avgBurn.toLocaleString()} − 必要赤字 {goal.requiredDailyDeficit.toLocaleString()}(脂肪1kg ≈ 7,200kcal)
                  </Text>
                )}
                {goal.intakeClamped && (
                  <Text style={styles.intakeWarn}>
                    ⚠️ 逆算した目標摂取が基礎代謝({goal.bmr?.toLocaleString()}kcal)を下回ったため、基礎代謝を下限にしています。この期日での達成は難しく、
                    {goal.achievableDate ? `達成可能日の目安は ${fmtShortDate(goal.achievableDate)} です` : '目標日を後ろにずらすのがおすすめです'}
                  </Text>
                )}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.goalSub}>
            目標体重と期日を設定すると、必要ペース・1日の目標摂取カロリー・カロリー貯金の進捗が出ます
          </Text>
        )}
      </Card>

      {/* 日次カロリー収支(1日単位が主役。赤字=緑) */}
      <Card style={styles.goalCard}>
        <Text style={styles.goalLabel}>日次カロリー収支(直近14日)</Text>
        <BalanceBars data={balances} />
      </Card>

      {/* 目標達成予測(赤字プラン基準: 期日までに必要な赤字を毎日出せているか) */}
      {pf?.hasPlan && (
        <Card style={styles.goalCard}>
          <Text style={styles.goalLabel}>
            達成予測({pf.metricLabel} {pf.currentText ?? '–'} → {pf.targetText ?? '–'})
          </Text>

          {pf.loggedDays === 0 ? (
            <Text style={styles.goalSub}>
              食事を記録すると予測が出ます。まずは今日、消費より
              {pf.requiredDailyDeficit != null ? ` ${pf.requiredDailyDeficit.toLocaleString()}kcal ` : ''}
              少なく食べるところから始めましょう。
            </Text>
          ) : (
            <>
              <View style={styles.pfRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalMain}>
                    {pf.projectedDate ? `${fmtShortDate(pf.projectedDate)} 達成` : '—'}
                  </Text>
                  <Text style={styles.goalSub}>このままのペースなら</Text>
                </View>
                {pf.onTrackProbability != null && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.goalMain, {
                      color: pf.onTrackProbability >= 70 ? Colors.good
                        : pf.onTrackProbability >= 40 ? Colors.warn : Colors.bad,
                    }]}>
                      {pf.onTrackProbability}%
                    </Text>
                    <Text style={styles.goalSub}>
                      期日{pf.deadline ? ` ${fmtShortDate(pf.deadline)} ` : ''}達成確率
                      {pf.probabilityIsReference ? '(参考値)' : ''}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.pfDivider} />
              <Text style={styles.pfCompare}>
                必要赤字 {pf.requiredDailyDeficit?.toLocaleString() ?? '–'}kcal/日 ・
                実績 {pf.avgDailyDeficit != null ? `${pf.avgDailyDeficit.toLocaleString()}kcal/日` : '–'}
                (直近{pf.loggedDays}日中 {pf.achievedDays}日達成)
              </Text>
              {pf.extraNeededPerDay != null && pf.extraNeededPerDay > 0 ? (
                <Text style={styles.pfAdvice}>
                  あと1日 {pf.extraNeededPerDay.toLocaleString()}kcal の赤字上積みで期日に間に合います
                </Text>
              ) : (
                <Text style={[styles.pfAdvice, { color: Colors.good }]}>
                  今のペースをキープすれば期日達成です 🔥
                </Text>
              )}
              {pf.projectionBasis === 'weight_trend' && (
                <Text style={styles.goalSub}>予測は体重の7日移動平均トレンドに基づいています</Text>
              )}
              {pf.lowConfidence && (
                <Text style={[styles.goalSub, { color: Colors.warn }]}>
                  ⚠️ データ不足(食事記録{pf.loggedDays}日分)・信頼度低。記録を続けると精度が上がります
                </Text>
              )}
            </>
          )}
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

      {/* 週単位の収支(参考。1日単位が主役なので下部に控えめに置く) */}
      {budget && (
        <>
          <SectionTitle>週単位の収支(参考)</SectionTitle>
          <Card>
            <View style={styles.budgetRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.budgetNum}>{budget.remaining.toLocaleString()}</Text>
                <Text style={styles.budgetCap}>今週残り kcal</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.budgetNum}>
                  {(goal?.targetIntakeKcal ?? budget.perDayRecommended).toLocaleString()}
                </Text>
                <Text style={styles.budgetCap}>今日の目標摂取 kcal</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.budgetNum}>{goal?.avgBurn ?? tdee?.effective ?? '–'}</Text>
                <Text style={styles.budgetCap}>週平均TDEE(消費) kcal/日</Text>
              </View>
            </View>
          </Card>
        </>
      )}

      {/* 目標編集モーダル */}
      <GoalEditModal
        visible={editOpen}
        goal={goal}
        onClose={() => setEditOpen(false)}
        onSave={saveGoal}
      />

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
    </View>
  );
}

function GoalStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.goalStat}>
      <Text style={styles.goalStatValue}>{value}</Text>
      <Text style={styles.goalStatLabel}>{label}</Text>
    </View>
  );
}

/** 日次収支のミニ棒グラフ。赤字=下向き緑バー、黒字=上向き赤バー */
function BalanceBars({ data }: { data: DayBalance[] }) {
  const maxAbs = Math.max(300, ...data.map((d) => Math.abs(d.balance ?? 0)));
  return (
    <View style={styles.barsRow}>
      {data.map((d) => {
        const bal = d.balance;
        const h = bal != null ? Math.max(3, (Math.abs(bal) / maxAbs) * 44) : 0;
        const deficit = bal != null && bal < 0;
        return (
          <View key={d.date} style={styles.barCol}>
            <View style={styles.barHalfTop}>
              {bal != null && !deficit && (
                <View style={[styles.bar, { height: h, backgroundColor: Colors.surplus }]} />
              )}
            </View>
            <View style={styles.barZeroLine} />
            <View style={styles.barHalfBottom}>
              {bal != null && deficit && (
                <View style={[styles.bar, { height: h, backgroundColor: Colors.deficit }]} />
              )}
              {bal == null && <View style={styles.barDot} />}
            </View>
            <Text style={styles.barLabel}>{Number(d.date.slice(8, 10))}</Text>
          </View>
        );
      })}
    </View>
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
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLink: { color: Colors.accent, fontSize: Type.label, fontWeight: '700' },
  goalSubMetric: { color: Colors.textFaint, fontSize: Type.caption, marginLeft: 4 },
  pfRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6, gap: Spacing.md },
  pfDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  pfCompare: { color: Colors.textSecondary, fontSize: Type.caption, fontVariant: ['tabular-nums'], lineHeight: 17 },
  pfAdvice: { color: Colors.accent, fontSize: Type.body, fontWeight: '600', marginTop: 6 },
  goalWeights: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: 6 },
  goalNow: { color: Colors.text, fontSize: 30, fontFamily: Fonts.display, fontWeight: '700', fontVariant: ['tabular-nums'] },
  goalArrow: { color: Colors.textFaint, fontSize: 20 },
  goalTargetNum: { color: Colors.accent, fontSize: 30, fontFamily: Fonts.display, fontWeight: '700', fontVariant: ['tabular-nums'] },
  goalUnit: { fontSize: Type.caption, color: Colors.textSecondary, fontWeight: '400' },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.sm, gap: Spacing.sm },
  goalStat: { minWidth: '45%', flexGrow: 1 },
  goalStatValue: { color: Colors.text, fontSize: Type.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  goalStatLabel: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 1 },
  intakeRow: {
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  intakeMain: { color: Colors.accent, fontSize: Type.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  intakeSub: { color: Colors.textSecondary, fontSize: Type.caption, marginTop: 2, fontVariant: ['tabular-nums'] },
  intakeFormula: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 4, fontVariant: ['tabular-nums'] },
  intakeWarn: { color: Colors.warn, fontSize: Type.caption, marginTop: 6, lineHeight: 16 },
  barsRow: { flexDirection: 'row', gap: 3, marginTop: Spacing.sm },
  barCol: { flex: 1, alignItems: 'center' },
  barHalfTop: { height: 46, width: '100%', justifyContent: 'flex-end' },
  barHalfBottom: { height: 46, width: '100%' },
  barZeroLine: { height: 1, width: '100%', backgroundColor: Colors.border },
  bar: { width: '70%', alignSelf: 'center', borderRadius: 2 },
  barDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.textFaint, alignSelf: 'center', marginTop: 4 },
  barLabel: { color: Colors.textFaint, fontSize: 9, marginTop: 3, fontVariant: ['tabular-nums'] },
  modalRoot: { flex: 1, backgroundColor: Colors.bg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  modalTitle: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  modalCancel: { color: Colors.textSecondary, fontSize: Type.body },
  modalSave: { color: Colors.accent, fontSize: Type.body, fontWeight: '700' },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  modalInput: {
    flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 20, fontVariant: ['tabular-nums'],
  },
  modalUnit: { color: Colors.textSecondary, fontSize: Type.body },
  modalHint: { color: Colors.textFaint, fontSize: Type.caption, marginTop: Spacing.sm, lineHeight: 16 },
  modalDateText: { color: Colors.accent, fontSize: Type.body, fontWeight: '600', paddingVertical: 4 },
  pfcRow: { flexDirection: 'row', gap: Spacing.sm },
  pfcLabel: { color: Colors.textSecondary, fontSize: Type.caption, marginBottom: 4 },
  pfcInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 8, paddingVertical: 8, fontSize: Type.body,
    fontVariant: ['tabular-nums'], textAlign: 'center',
  },
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
