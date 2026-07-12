/**
 * My Body: 体重・体脂肪率を主役に、カロリー収支(赤字/黒字)とカロリー貯金、
 * その日の全計測データを1画面で見る。左右スワイプで日付を移動できる。
 */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/BrandHeader';
import { Card, Chip, SectionTitle } from '@/components/ui';
import { SettingsSheet } from '@/components/SettingsSheet';
import { Colors, Fonts, Spacing, Type, scoreColor } from '@/constants/theme';
import { scoresForDate, useDashboard, useHealthAuth } from '@/hooks/useHealthData';
import type { Scores } from '@/utils/score';
import { getCustomTags, addCustomTag, addTag, removeTag, getTags, getRange } from '@/lib/db';
import { addDays, formatKeyJa, fromKey, toKey, todayKey } from '@/lib/dates';
import { BODY_DETAIL_ORDER, METRICS, formatValue, PRESET_TAGS, type MetricKey } from '@/lib/metrics';
import { listMealLogs, listTemplates, listWorkoutLogs, localDateKey } from '@/lib/store';
import { balanceSeries, calorieBank, KCAL_PER_KG_FAT, type BankSummary, type DayBalance } from '@/utils/deficit';

/** 左から: コンディション・睡眠・活動・体組成 (Ouraと同じ並び感) */
const CATEGORIES = [
  { key: 'condition' as const, label: 'コンディション', color: Colors.recovery },
  { key: 'sleep' as const, label: '睡眠', color: Colors.sleep },
  { key: 'activity' as const, label: '活動', color: Colors.activity },
  { key: 'body' as const, label: '体組成', color: Colors.body },
];

interface MealRow { id: string; time: string; label: string; kcal: number }
interface WorkoutRow { id: string; time: string; label: string; detail: string }

interface DayData {
  metrics: Partial<Record<MetricKey, number>>;
  /** 体重・体脂肪率は7日以内の直近値で補完(計測しない日も空欄にしない) */
  weight: number | null;
  bodyFat: number | null;
  balance: DayBalance | null;
  tags: string[];
  /** その日に記録された食事・運動(実績報告タブ/AIチャット経由) */
  meals: MealRow[];
  workouts: WorkoutRow[];
}

const hhmm = (iso: string): string => {
  const t = new Date(iso);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
};

export default function MyBodyScreen() {
  const insets = useSafeAreaInsets();
  const { status, request } = useHealthAuth();
  const d = useDashboard();
  const [dateKey, setDateKey] = useState(todayKey());
  const [day, setDay] = useState<DayData | null>(null);
  const [bank, setBank] = useState<BankSummary | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [customTags, setCustomTags] = useState<{ name: string; emoji: string }[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 根拠を展開中のスコアカード */
  const [expanded, setExpanded] = useState<(typeof CATEGORIES)[number]['key'] | null>(null);

  const isToday = dateKey === todayKey();

  useEffect(() => {
    if (status != null && status !== 2) request().catch(() => {});
  }, [status, request]);

  useEffect(() => {
    getCustomTags().then(setCustomTags).catch(() => {});
  }, []);

  const loadDay = useCallback(async (key: string) => {
    try {
      const range = await getRange(toKey(addDays(fromKey(key), -7)), key);
      const metrics = range.get(key) ?? {};
      // carry-forward: 7日以内の直近値
      let weight: number | null = null;
      let bodyFat: number | null = null;
      for (let i = 7; i >= 0; i--) {
        const k = toKey(addDays(fromKey(key), -i));
        const m = range.get(k);
        if (m?.weight != null) weight = m.weight;
        if (m?.body_fat != null) bodyFat = m.body_fat;
      }
      const daysBack = Math.max(0, Math.round((fromKey(todayKey()).getTime() - fromKey(key).getTime()) / 86400000));
      const series = await balanceSeries(daysBack + 1);
      const balance = series.length > 0 ? series[0] : null;
      const tags = await getTags(key);

      // その日の食事・運動リスト。前後1日広めに取ってローカル日付で絞る
      // (タイムスタンプのTZ表現の揺れがあっても取りこぼさない)
      const dayStart = fromKey(key);
      const qFrom = addDays(dayStart, -1).toISOString();
      const qTo = addDays(dayStart, 2).toISOString();
      const tplName = new Map((await listTemplates()).map((t) => [t.id, t.name]));
      const meals: MealRow[] = (await listMealLogs(qFrom, qTo))
        .filter((m) => localDateKey(m.timestamp) === key)
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
        .map((m) => ({
          id: m.id,
          time: hhmm(m.timestamp),
          label: m.freeText ?? (m.templateId != null ? tplName.get(m.templateId) : null) ?? '食事',
          kcal: Math.round(m.kcal),
        }));
      const workouts: WorkoutRow[] = (await listWorkoutLogs(qFrom, qTo))
        .filter((w) => localDateKey(w.timestamp) === key)
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
        .map((w) => {
          const isCardio = w.exercises.length === 1 && w.exercises[0].reps === 1 && w.exercises[0].sets === 1;
          const label = isCardio
            ? w.exercises[0].exerciseName
            : w.exercises.map((e) => e.exerciseName).join('・') || 'トレーニング';
          const detail = [
            w.durationMin != null ? `${Math.round(w.durationMin)}分` : null,
            !isCardio && w.exercises.length > 0 ? `${w.exercises.length}種目` : null,
          ].filter(Boolean).join(' ・ ');
          return { id: w.id, time: hhmm(w.timestamp), label, detail };
        });

      setDay({ metrics, weight, bodyFat, balance, tags, meals, workouts });
      setScores(await scoresForDate(key)); // 過去日も同じフォーマットでスコアを出す
      setBank(await calorieBank(key)); // その日「時点まで」の累積
    } catch { /* 表示は次のフォーカスで再試行 */ }
  }, []);

  useFocusEffect(useCallback(() => { loadDay(dateKey); }, [loadDay, dateKey]));

  const shiftDay = useCallback((dir: 1 | -1) => {
    setDateKey((prev) => {
      const next = toKey(addDays(fromKey(prev), dir));
      return next > todayKey() ? todayKey() : next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // 左スワイプ=1日前へ、右スワイプ=1日先へ
  const swipe = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-32, 32])
      .failOffsetY([-16, 16])
      .onEnd((e) => {
        'worklet';
        if (e.translationX > 56) runOnJS(shiftDay)(-1);
        else if (e.translationX < -56) runOnJS(shiftDay)(1);
      }),
    [shiftDay],
  );

  const onTag = async (tag: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = await getTags(dateKey);
    if (current.includes(tag)) await removeTag(dateKey, tag);
    else await addTag(dateKey, tag);
    loadDay(dateKey);
  };

  const onAddCustomTag = () => {
    Alert.prompt('カスタムタグを追加', 'タグ名を入力(例: サウナ)', async (name) => {
      if (!name?.trim()) return;
      await addCustomTag(name.trim(), '🏷');
      setCustomTags(await getCustomTags());
    });
  };

  const allTags = [...PRESET_TAGS, ...customTags];
  const bal = day?.balance?.balance ?? null;
  const deficit = bal != null && bal < 0;
  const fatGram = bal != null ? Math.abs(Math.round((bal / KCAL_PER_KG_FAT) * 1000)) : null;

  const statRows = BODY_DETAIL_ORDER
    .filter((key) => day?.metrics[key] != null)
    .map((key) => [key, METRICS[key].label, METRICS[key].asDuration ? '' : ` ${METRICS[key].unit}`] as const);

  return (
    <GestureDetector gesture={swipe}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 120, paddingHorizontal: Spacing.md }}
        refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={() => { d.refresh(); loadDay(dateKey); }} tintColor={Colors.accent} />}
      >
        {/* 日付ナビゲーション(スワイプでも移動可)+ 設定 */}
        <View style={styles.dateNav}>
          <Pressable onPress={() => shiftDay(-1)} hitSlop={10} style={styles.dateBtn}>
            <Text style={styles.dateBtnText}>‹</Text>
          </Pressable>
          <BrandHeader sub={isToday ? `My Body ・ 今日 ${formatKeyJa(dateKey)}` : `My Body ・ ${formatKeyJa(dateKey)}`} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setSettingsOpen(true)} hitSlop={10} style={styles.dateBtn}>
              <Text style={styles.gearText}>⚙︎</Text>
            </Pressable>
            <Pressable onPress={() => shiftDay(1)} hitSlop={10} style={[styles.dateBtn, isToday && { opacity: 0.25 }]}>
              <Text style={styles.dateBtnText}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* スコア(コンディション・睡眠・活動・体組成)。過去日も表示。タップで根拠 */}
        {scores != null && (
          <>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => {
                const v = scores[c.key].score;
                return (
                  <Pressable
                    key={c.key}
                    style={{ flex: 1 }}
                    onPress={() => setExpanded(expanded === c.key ? null : c.key)}
                  >
                    <Card style={[styles.categoryCard, expanded === c.key && { borderColor: c.color, borderWidth: 1 }]}>
                      <Text style={[styles.categoryValue, { color: scoreColor(v) }]}>{v ?? '–'}</Text>
                      <View style={styles.categoryLabelRow}>
                        <View style={[styles.dot, { backgroundColor: c.color }]} />
                        <Text style={styles.categoryLabel} numberOfLines={1} adjustsFontSizeToFit>
                          {c.label}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
            {expanded != null && (
              <Card style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>
                  {CATEGORIES.find((c) => c.key === expanded)?.label}スコアの根拠
                </Text>
                {scores[expanded].parts.length === 0 ? (
                  <Text style={styles.balanceEmpty}>この日は算出に必要なデータがありません</Text>
                ) : (
                  scores[expanded].parts.map((p, i) => (
                    <View key={p.label} style={[styles.statRow, i > 0 && styles.statRowBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.statLabel}>{p.label}</Text>
                        <Text style={styles.breakdownDetail}>{p.detail}</Text>
                      </View>
                      <Text style={[styles.statValue, { color: scoreColor(p.score) }]}>
                        {p.score != null ? Math.round(p.score) : '–'}
                      </Text>
                    </View>
                  ))
                )}
              </Card>
            )}
          </>
        )}

        {/* 主役: 体重と体脂肪率 */}
        <View style={styles.heroRow}>
          <Card style={styles.heroCard}>
            <Text style={styles.heroLabel}>体重</Text>
            <Text style={styles.heroValue}>
              {day?.weight != null ? formatValue('weight', day.weight) : '–'}
              <Text style={styles.heroUnit}> kg</Text>
            </Text>
          </Card>
          <Card style={styles.heroCard}>
            <Text style={styles.heroLabel}>体脂肪率</Text>
            <Text style={styles.heroValue}>
              {day?.bodyFat != null ? formatValue('body_fat', day.bodyFat) : '–'}
              <Text style={styles.heroUnit}> %</Text>
            </Text>
            {isToday && d.forecast && d.forecast.diff > 0 && (
              <Text style={styles.heroSub}>目標まで {d.forecast.diff.toFixed(1)}%</Text>
            )}
            {isToday && d.forecast && d.forecast.diff <= 0 && (
              <Text style={[styles.heroSub, { color: Colors.good }]}>目標達成中</Text>
            )}
          </Card>
        </View>

        {/* カロリー: 今日は「残り予算」を主役に(単日の赤字を大きく見せない)、過去日は確定収支 */}
        <Card style={[styles.balanceCard, bal != null && { borderColor: deficit ? Colors.deficit : Colors.surplus, borderWidth: 1 }]}>
          <View style={styles.balanceHead}>
            <Text style={styles.heroLabel}>{isToday ? '今日あと食べられる' : 'この日のカロリー収支(確定)'}</Text>
            {isToday ? (
              <View style={[styles.badge, { backgroundColor: Colors.surfaceRaised }]}>
                <Text style={[styles.badgeText, { color: Colors.textSecondary }]}>
                  {day?.balance?.provisional ? 'TDEE暫定' : 'TDEE確定'}
                </Text>
              </View>
            ) : (
              bal != null && (
                <View style={[styles.badge, { backgroundColor: deficit ? Colors.accentDim : '#5C2320' }]}>
                  <Text style={[styles.badgeText, { color: deficit ? Colors.deficit : Colors.surplus }]}>
                    {deficit ? '🔥 脂肪燃焼' : '食べ過ぎ'}
                  </Text>
                </View>
              )
            )}
          </View>
          {bal != null ? (
            <>
              {isToday ? (
                <Text style={[styles.balanceValue, { color: -bal >= 0 ? Colors.accent : Colors.surplus }]}>
                  {(-bal) >= 0 ? (-bal).toLocaleString() : `${Math.abs(-bal).toLocaleString()}オーバー`}
                  {(-bal) >= 0 && <Text style={styles.heroUnit}> kcal</Text>}
                </Text>
              ) : (
                <Text style={[styles.balanceValue, { color: deficit ? Colors.deficit : Colors.surplus }]}>
                  {bal > 0 ? '+' : '−'}{Math.abs(bal).toLocaleString()}
                  <Text style={styles.heroUnit}> kcal</Text>
                  {fatGram != null && (
                    <Text style={[styles.bankFat, { color: deficit ? Colors.deficit : Colors.surplus }]}>
                      {'  '}≈ 脂肪{deficit ? '−' : '+'}{fatGram}g
                    </Text>
                  )}
                </Text>
              )}
              {/* 摂取 vs 消費(この差だけ痩せる/太る、を常に見せる) */}
              {(() => {
                const intake = day?.balance?.intake ?? 0;
                const burn = day?.balance?.burn ?? 0;
                const max = Math.max(intake, burn, 1);
                return (
                  <View style={{ marginTop: Spacing.sm }}>
                    <View style={styles.vsRow}>
                      <Text style={styles.vsLabel}>食べた</Text>
                      <View style={styles.vsTrack}>
                        <View style={[styles.vsFill, {
                          width: `${Math.max(2, (intake / max) * 100)}%`,
                          backgroundColor: deficit ? Colors.accentDim : Colors.surplus,
                        }]} />
                      </View>
                      <Text style={styles.vsNum}>{intake.toLocaleString()}</Text>
                    </View>
                    <View style={styles.vsRow}>
                      <Text style={styles.vsLabel}>消費</Text>
                      <View style={styles.vsTrack}>
                        <View style={[styles.vsFill, {
                          width: `${Math.max(2, (burn / max) * 100)}%`,
                          backgroundColor: Colors.deficit,
                        }]} />
                      </View>
                      <Text style={styles.vsNum}>{burn.toLocaleString()}</Text>
                    </View>
                    {isToday && (
                      <Text style={styles.balanceSub}>
                        {day?.balance?.provisional ? '暫定' : ''}TDEE {burn.toLocaleString()} − 摂取 {intake.toLocaleString()}
                        {' ・ '}ここまでの収支 {bal! > 0 ? '+' : '−'}{Math.abs(bal!).toLocaleString()}kcal
                      </Text>
                    )}
                    {day?.balance?.parts && (
                      <Text style={styles.vsHint}>
                        TDEE内訳: 基礎代謝 {day.balance.parts.bmr.toLocaleString()} + 歩行 {day.balance.parts.neat.toLocaleString()} + 運動 {day.balance.parts.eat.toLocaleString()} + 食事熱 {day.balance.parts.dit.toLocaleString()}
                      </Text>
                    )}
                    <Text style={styles.vsHint}>
                      {deficit ? '消費が摂取を上回った分だけ、脂肪が減ります' : '摂取が消費を上回った分は、脂肪として蓄えられます'}
                    </Text>
                  </View>
                );
              })()}
            </>
          ) : (
            <Text style={styles.balanceEmpty}>
              {day?.balance?.intake == null
                ? '食事を記録すると収支が出ます(実績報告タブ or AIチャット)'
                : '設定タブで身長・生年月日を入れると消費カロリーを計算できます'}
            </Text>
          )}
        </Card>

        {/* カロリー赤字の累積(ゲーム化) */}
        {bank && (bank.countedDays > 0 || bank.neededKcal != null) && (
          <Card style={styles.bankCard}>
            <View style={styles.balanceHead}>
              <Text style={styles.heroLabel}>{isToday ? 'カロリー赤字(累積)' : 'この日時点のカロリー赤字(累積)'}</Text>
              {bank.streakDays >= 2 && (
                <Text style={styles.streakText}>🔥 {bank.streakDays}日連続脂肪燃焼中</Text>
              )}
            </View>
            <Text style={styles.bankValue}>
              {bank.bankedKcal.toLocaleString()}
              <Text style={styles.heroUnit}> kcal</Text>
              <Text style={styles.bankFat}>  ≈ 脂肪{bank.fatKgEquivalent}kg分</Text>
            </Text>
            {bank.neededKcal != null && bank.progress != null ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(bank.progress * 100)}%` }]} />
                </View>
                <Text style={styles.balanceSub}>
                  目標まで {Math.max(0, Math.round(bank.neededKcal - bank.bankedKcal)).toLocaleString()}kcal
                  ({Math.round(bank.progress * 100)}% 達成)
                </Text>
              </>
            ) : (
              <Text style={styles.balanceSub}>トレンドタブで目標体重を設定すると進捗バーが出ます</Text>
            )}
          </Card>
        )}

        {/* その日の食事・運動の記録 */}
        <SectionTitle>{isToday ? '今日の食事' : 'この日の食事'}</SectionTitle>
        <Card>
          {day != null && day.meals.length > 0 ? (
            <>
              {day.meals.map((m, i) => (
                <View key={m.id} style={[styles.statRow, i > 0 && styles.statRowBorder]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                    <Text style={styles.logTime}>{m.time}</Text>
                    <Text style={styles.statLabel} numberOfLines={1}>{m.label}</Text>
                  </View>
                  <Text style={styles.statValue}>{m.kcal.toLocaleString()}<Text style={styles.statUnit}> kcal</Text></Text>
                </View>
              ))}
              <View style={[styles.statRow, styles.statRowBorder]}>
                <Text style={[styles.statLabel, { fontWeight: '700', color: Colors.text }]}>合計</Text>
                <Text style={[styles.statValue, { color: Colors.accent }]}>
                  {day.meals.reduce((a, m) => a + m.kcal, 0).toLocaleString()}<Text style={styles.statUnit}> kcal</Text>
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.balanceEmpty}>{isToday ? 'まだ記録がありません(実績報告タブ or Mr. Vyta)' : 'この日の食事記録はありません'}</Text>
          )}
        </Card>

        <SectionTitle>{isToday ? '今日の運動' : 'この日の運動'}</SectionTitle>
        <Card>
          {day != null && day.workouts.length > 0 ? (
            day.workouts.map((w, i) => (
              <View key={w.id} style={[styles.statRow, i > 0 && styles.statRowBorder]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                  <Text style={styles.logTime}>{w.time}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{w.label}</Text>
                </View>
                {w.detail !== '' && <Text style={styles.statValue}>{w.detail}</Text>}
              </View>
            ))
          ) : (
            <Text style={styles.balanceEmpty}>
              {day?.metrics.workout_energy != null
                ? `手動の記録なし(Apple Watchのワークアウト ${formatValue('workout_energy', day.metrics.workout_energy)}kcal は消費に反映済み)`
                : isToday ? 'まだ記録がありません(実績報告タブ or Mr. Vyta)' : 'この日の運動記録はありません'}
            </Text>
          )}
        </Card>

        {/* 体調変化の兆候(今日のみ) */}
        {isToday && d.anomalies.length > 0 && (
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

        {/* 全計測データ(OuraとWithingsが書き込んだものすべて) */}
        <SectionTitle>{isToday ? '今日の計測データ' : 'この日の計測データ'}</SectionTitle>
        {statRows.length > 0 ? (
          <Card>
            {statRows.map(([key, label, unit], i) => (
              <View key={key} style={[styles.statRow, i > 0 && styles.statRowBorder]}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>
                  {formatValue(key, day?.metrics[key])}
                  <Text style={styles.statUnit}>{unit}</Text>
                </Text>
              </View>
            ))}
          </Card>
        ) : (
          <Card><Text style={styles.balanceEmpty}>この日の計測データがありません</Text></Card>
        )}

        {/* タグ記録 */}
        <SectionTitle>{isToday ? '今日のタグ' : 'この日のタグ'}</SectionTitle>
        <View style={styles.tagWrap}>
          {allTags.map((t) => (
            <Chip
              key={t.name}
              label={`${t.emoji} ${t.name}`}
              active={day?.tags.includes(t.name)}
              onPress={() => onTag(t.name)}
            />
          ))}
          <Chip label="+ 追加" onPress={onAddCustomTag} />
        </View>

        {/* 設定(タブではなく⚙から開くモーダル) */}
        <SettingsSheet visible={settingsOpen} onClose={() => { setSettingsOpen(false); loadDay(dateKey); }} />
      </ScrollView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  dateBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  dateBtnText: { color: Colors.text, fontSize: 24, lineHeight: 26 },
  gearText: { color: Colors.textSecondary, fontSize: 20, lineHeight: 22 },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  vsLabel: { color: Colors.textSecondary, fontSize: Type.caption, width: 40 },
  vsTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' },
  vsFill: { height: 12, borderRadius: 6 },
  vsNum: { color: Colors.text, fontSize: Type.caption, fontWeight: '600', fontVariant: ['tabular-nums'], width: 46, textAlign: 'right' },
  vsHint: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 6 },
  screenTitle: { color: Colors.text, fontSize: Type.title, fontFamily: Fonts.sans, fontWeight: '700' },
  date: { color: Colors.textSecondary, fontSize: Type.caption, marginTop: 2 },
  heroRow: { flexDirection: 'row', gap: Spacing.sm },
  heroCard: { flex: 1, paddingVertical: Spacing.md },
  heroLabel: { color: Colors.textSecondary, fontSize: Type.caption },
  heroValue: {
    color: Colors.text, fontSize: 40, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 4,
  },
  heroUnit: { fontSize: Type.body, color: Colors.textSecondary, fontWeight: '400' },
  heroSub: { color: Colors.accent, fontSize: Type.caption, marginTop: 4 },
  balanceCard: { marginTop: Spacing.sm },
  balanceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: Type.label, fontWeight: '700' },
  balanceValue: {
    fontSize: 34, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 4,
  },
  balanceSub: { color: Colors.textSecondary, fontSize: Type.caption, marginTop: 6, fontVariant: ['tabular-nums'] },
  balanceEmpty: { color: Colors.textFaint, fontSize: Type.body, lineHeight: 20, marginTop: 4 },
  bankCard: { marginTop: Spacing.sm },
  streakText: { color: Colors.activity, fontSize: Type.label, fontWeight: '700' },
  bankValue: {
    color: Colors.text, fontSize: 28, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 4,
  },
  bankFat: { fontSize: Type.body, color: Colors.accent, fontWeight: '600' },
  progressTrack: {
    height: 10, borderRadius: 5, backgroundColor: Colors.surfaceRaised,
    marginTop: Spacing.sm, overflow: 'hidden',
  },
  progressFill: { height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  categoryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  categoryCard: { alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: 4 },
  breakdownCard: { marginBottom: Spacing.sm },
  breakdownTitle: { color: Colors.textSecondary, fontSize: Type.caption, marginBottom: 4 },
  breakdownDetail: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 2 },
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
  logTime: { color: Colors.textFaint, fontSize: Type.caption, fontVariant: ['tabular-nums'], width: 40 },
  statValue: { color: Colors.text, fontSize: Type.body, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statUnit: { color: Colors.textFaint, fontSize: Type.caption, fontWeight: '400' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
