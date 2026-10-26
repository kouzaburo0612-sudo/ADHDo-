/**
 * 朝の記録(トレーナー毎日報告用)
 * ================================
 * トレーナー指定のテンプレをそのまま1画面に収め、スクショ1回で送れるようにする。
 *   【◯/◯ 朝の記録】
 *   ・体重 / 体調(1〜5) / 睡眠(Ouraスコア/時間) / 昨日の過ごし方 /
 *   ・昨日のアクティビティスコア(Oura) / 昨日の歩数 /
 *   ・昨日のトレーニング / 昨日の食事(一覧+合計)
 * 体調(1〜5)だけは自動で取れないため、カード上でタップ入力して保存する(kv)。
 * 「共有」ボタンでテンプレ書式のテキストをそのままLINE等へ送れる。
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { getRange, kvGet, kvSet } from '@/lib/db';
import { addDays, fromKey, toKey, todayKey } from '@/lib/dates';
import { listMealLogs, listTemplates, listWorkoutLogs, localDateKey } from '@/lib/store';

interface MealLine { id: string; time: string; label: string; kcal: number }

interface ReportData {
  /** 体重(今日。未計測なら7日以内の直近値で補完) */
  weightKg: number | null;
  /** 今朝のOura睡眠スコア */
  sleepScore: number | null;
  /** 昨晩の睡眠時間(分) */
  sleepMin: number | null;
  /** 昨日の歩数 */
  ySteps: number | null;
  /** 昨日のOuraアクティビティスコア */
  yActivityScore: number | null;
  /** 昨日のトレーニング(アプリ内ログ)。なければ空配列 */
  yWorkouts: { label: string; durationMin: number | null }[];
  /** 昨日のApple Watchワークアウト消費(手動ログがない日の補足) */
  yWorkoutEnergy: number | null;
  /** 昨日の食事 */
  yMeals: MealLine[];
  yPfc: { p: number; f: number; c: number };
}

const hhmm = (iso: string): string => {
  const t = new Date(iso);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
};

const fmtSleep = (min: number | null): string | null => {
  if (min == null) return null;
  const m = Math.round(min);
  return `${Math.floor(m / 60)}時間${String(m % 60).padStart(2, '0')}分`;
};

/** 昨日の過ごし方をトレーナーの3択(座り中心/移動多め/よく動いた)に歩数から自動判定 */
const lifestyleOf = (steps: number | null): string | null => {
  if (steps == null) return null;
  if (steps < 5000) return '座り中心';
  if (steps < 10000) return '移動多め';
  return 'よく動いた';
};

async function loadReport(tk: string, yk: string): Promise<ReportData> {
  const range = await getRange(toKey(addDays(fromKey(tk), -7)), tk);

  // 体重は7日以内の直近値で補完(朝イチで未計測でも空欄にしない)
  let weightKg: number | null = null;
  for (let i = 7; i >= 0; i--) {
    const v = range.get(toKey(addDays(fromKey(tk), -i)))?.weight;
    if (v != null) weightKg = v;
  }
  const today = range.get(tk) ?? {};
  const yday = range.get(yk) ?? {};

  // 昨日の食事・トレ。TZ表現の揺れに備えて広めに取ってローカル日付で絞る
  const qFrom = addDays(fromKey(yk), -1).toISOString();
  const qTo = addDays(fromKey(yk), 2).toISOString();
  const tplName = new Map((await listTemplates()).map((t) => [t.id, t.name]));
  const rawMeals = (await listMealLogs(qFrom, qTo))
    .filter((m) => localDateKey(m.timestamp) === yk)
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const yMeals: MealLine[] = rawMeals.map((m) => ({
    id: m.id,
    time: hhmm(m.timestamp),
    label: m.freeText ?? (m.templateId != null ? tplName.get(m.templateId) : null) ?? '食事',
    kcal: Math.round(m.kcal),
  }));
  const yPfc = rawMeals.reduce(
    (a, m) => ({ p: a.p + m.protein, f: a.f + m.fat, c: a.c + m.carbs }),
    { p: 0, f: 0, c: 0 },
  );
  const yWorkouts = (await listWorkoutLogs(qFrom, qTo))
    .filter((w) => localDateKey(w.timestamp) === yk)
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
    .map((w) => {
      const isCardio = w.exercises.length === 1 && w.exercises[0].reps === 1 && w.exercises[0].sets === 1;
      const label = isCardio
        ? w.exercises[0].exerciseName
        : w.exercises.map((e) => e.exerciseName).join('・') || 'トレーニング';
      return { label, durationMin: w.durationMin ?? null };
    });

  return {
    weightKg,
    sleepScore: today.oura_sleep_score ?? null,
    sleepMin: today.sleep_total ?? null,
    ySteps: yday.steps != null ? Math.round(yday.steps) : null,
    yActivityScore: yday.oura_activity_score ?? null,
    yWorkouts,
    yWorkoutEnergy: yday.workout_energy != null ? Math.round(yday.workout_energy) : null,
    yMeals,
    yPfc,
  };
}

/** 共有テキスト(トレーナーのテンプレ書式そのまま) */
function buildShareText(tk: string, d: ReportData, condition: number | null): string {
  const date = fromKey(tk);
  const na = '—';
  const sleep = d.sleepScore != null || d.sleepMin != null
    ? `${d.sleepScore ?? na}${d.sleepMin != null ? `/${fmtSleep(d.sleepMin)}` : ''}`
    : na;
  const training = d.yWorkouts.length > 0
    ? `あり(${d.yWorkouts.map((w) => w.label + (w.durationMin != null ? ` ${Math.round(w.durationMin)}分` : '')).join('、')})`
    : d.yWorkoutEnergy != null && d.yWorkoutEnergy > 0
      ? `あり(Apple Watchワークアウト ${d.yWorkoutEnergy}kcal)`
      : 'なし';
  const lines = [
    `【${date.getMonth() + 1}/${date.getDate()} 朝の記録】`,
    `・体重:${d.weightKg != null ? `${(Math.round(d.weightKg * 10) / 10).toFixed(1)}kg` : na}`,
    `・体調(1〜5):${condition ?? na}`,
    `・睡眠(Ouraスコア/時間):${sleep}`,
    `・昨日の過ごし方:${lifestyleOf(d.ySteps) ?? na}`,
    `・昨日のアクティビティスコア(Oura):${d.yActivityScore ?? na}`,
    `・昨日の歩数:${d.ySteps != null ? `${d.ySteps.toLocaleString()}歩` : na}`,
    `・昨日のトレーニング:${training}`,
    '・昨日の食事:',
  ];
  if (d.yMeals.length === 0) {
    lines.push('  記録なし');
  } else {
    for (const m of d.yMeals) lines.push(`  ${m.time} ${m.label} ${m.kcal.toLocaleString()}kcal`);
    const total = d.yMeals.reduce((a, m) => a + m.kcal, 0);
    lines.push(`  合計 ${total.toLocaleString()}kcal(P${Math.round(d.yPfc.p)}/F${Math.round(d.yPfc.f)}/C${Math.round(d.yPfc.c)})`);
  }
  return lines.join('\n');
}

export function MorningReport({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [condition, setCondition] = useState<number | null>(null);

  const tk = todayKey();
  const yk = toKey(addDays(fromKey(tk), -1));

  useEffect(() => {
    if (!visible) return;
    loadReport(tk, yk).then(setData).catch(() => {});
    kvGet(`morning_condition_${tk}`)
      .then((v) => setCondition(v != null ? Number(v) : null))
      .catch(() => {});
  }, [visible, tk, yk]);

  const onCondition = useCallback((n: number) => {
    setCondition(n);
    kvSet(`morning_condition_${tk}`, String(n)).catch(() => {});
  }, [tk]);

  const onShare = useCallback(() => {
    if (data == null) return;
    Share.share({ message: buildShareText(tk, data, condition) }).catch(() => {});
  }, [tk, data, condition]);

  const date = fromKey(tk);
  const na = <Text style={styles.na}>—</Text>;
  const mealTotal = data?.yMeals.reduce((a, m) => a + m.kcal, 0) ?? 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>朝の記録(トレーナー共有用)</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.headClose}>閉じる</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 24 }}>
          {/* ここから下がスクショ1枚に収まる本体 */}
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>【{date.getMonth() + 1}/{date.getDate()} 朝の記録】</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>・体重</Text>
              <Text style={styles.rowValue}>
                {data?.weightKg != null ? `${(Math.round(data.weightKg * 10) / 10).toFixed(1)} kg` : na}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>・体調(1〜5)</Text>
              <View style={styles.condRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    style={[styles.condBtn, condition === n && styles.condBtnActive]}
                    onPress={() => onCondition(n)}
                    hitSlop={4}
                  >
                    <Text style={[styles.condText, condition === n && styles.condTextActive]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>・睡眠(Ouraスコア/時間)</Text>
              <Text style={styles.rowValue}>
                {data?.sleepScore != null || data?.sleepMin != null
                  ? `${data?.sleepScore ?? '—'}${data?.sleepMin != null ? ` / ${fmtSleep(data.sleepMin)}` : ''}`
                  : na}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>・昨日の過ごし方</Text>
              <Text style={styles.rowValue}>{lifestyleOf(data?.ySteps ?? null) ?? na}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>・昨日のアクティビティスコア(Oura)</Text>
              <Text style={styles.rowValue}>{data?.yActivityScore ?? na}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>・昨日の歩数</Text>
              <Text style={styles.rowValue}>{data?.ySteps != null ? `${data.ySteps.toLocaleString()} 歩` : na}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>・昨日のトレーニング</Text>
              <Text style={[styles.rowValue, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={3}>
                {data == null ? '—'
                  : data.yWorkouts.length > 0
                    ? `あり(${data.yWorkouts.map((w) => w.label + (w.durationMin != null ? ` ${Math.round(w.durationMin)}分` : '')).join('、')})`
                    : data.yWorkoutEnergy != null && data.yWorkoutEnergy > 0
                      ? `あり(Watchワークアウト ${data.yWorkoutEnergy}kcal)`
                      : 'なし'}
              </Text>
            </View>

            <Text style={[styles.rowLabel, { marginTop: 10 }]}>・昨日の食事</Text>
            {data == null || data.yMeals.length === 0 ? (
              <Text style={styles.mealEmpty}>記録なし</Text>
            ) : (
              <>
                {data.yMeals.map((m) => (
                  <View key={m.id} style={styles.mealRow}>
                    <Text style={styles.mealTime}>{m.time}</Text>
                    <Text style={styles.mealLabel} numberOfLines={1}>{m.label}</Text>
                    <Text style={styles.mealKcal}>{m.kcal.toLocaleString()}</Text>
                  </View>
                ))}
                <View style={[styles.mealRow, styles.mealTotalRow]}>
                  <Text style={[styles.mealLabel, { fontWeight: '700', color: Colors.text }]}>合計</Text>
                  <Text style={[styles.mealKcal, { color: Colors.accent }]}>
                    {mealTotal.toLocaleString()} kcal
                    <Text style={styles.mealPfc}>
                      {'  '}P{Math.round(data.yPfc.p)} / F{Math.round(data.yPfc.f)} / C{Math.round(data.yPfc.c)}
                    </Text>
                  </Text>
                </View>
              </>
            )}

            <Text style={styles.brand}>VYTA</Text>
          </View>

          <Pressable style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareBtnText}>📤 テキストで共有(LINE等へそのまま送信)</Text>
          </Pressable>
          <Text style={styles.hint}>
            上のカードをスクショ1枚で送るか、共有ボタンでテンプレ書式のテキストを送れます。
            体調(1〜5)はタップで入力・保存されます。
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  headTitle: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  headClose: { color: Colors.textSecondary, fontSize: Type.body },
  // スクショ対象の本体カード(1枚に収まるよう行間は詰める)
  sheet: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  sheetTitle: {
    color: Colors.text, fontSize: 17, fontWeight: '800', marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  rowLabel: { color: Colors.textSecondary, fontSize: Type.body },
  rowValue: { color: Colors.text, fontSize: Type.body, fontWeight: '600', fontVariant: ['tabular-nums'] },
  na: { color: Colors.textFaint },
  condRow: { flexDirection: 'row', gap: 6 },
  condBtn: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.border,
  },
  condBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  condText: { color: Colors.textSecondary, fontSize: Type.body, fontWeight: '700' },
  condTextActive: { color: Colors.bg },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  mealTime: { color: Colors.textFaint, fontSize: Type.caption, fontVariant: ['tabular-nums'], width: 38 },
  mealLabel: { color: Colors.textSecondary, fontSize: Type.caption, flex: 1 },
  mealKcal: { color: Colors.text, fontSize: Type.caption, fontWeight: '600', fontVariant: ['tabular-nums'] },
  mealTotalRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, marginTop: 2, paddingTop: 7 },
  mealPfc: { color: Colors.textSecondary, fontWeight: '400' },
  mealEmpty: { color: Colors.textFaint, fontSize: Type.caption, paddingVertical: 4 },
  brand: {
    color: Colors.textFaint, fontSize: Type.label, fontFamily: Fonts.brand,
    textAlign: 'right', marginTop: 8, letterSpacing: 2,
  },
  shareBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  shareBtnText: { color: Colors.bg, fontSize: Type.body, fontWeight: '800' },
  hint: { color: Colors.textFaint, fontSize: Type.caption, marginTop: Spacing.sm, lineHeight: 16 },
});
