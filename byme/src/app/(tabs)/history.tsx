import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseModes } from '../../db/types';
import { toDateKey, todayKey } from '../../lib/dates';
import { completedDates } from '../../lib/stats';
import { useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

/**
 * HISTORY: 習慣化の状態を確認する補助画面。
 * ストリークだけを価値の中心にせず、今月・実施率・累計を併記する。
 */

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export default function History() {
  const sessions = useAppStore((s) => s.sessions);
  const items = useAppStore((s) => s.items);
  const stats = useAppStore((s) => s.stats);

  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const done = useMemo(() => completedDates(sessions), [sessions]);

  // カレンダー(表示月)
  const grid = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
    const cells: (number | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  // 長期間表示されていない項目(儀式対象なのに14日以上出ていない)
  const staleItems = useMemo(() => {
    const cutoff = Date.now() - 14 * 86400000;
    return items
      .filter(
        (i) =>
          i.archived_at === null &&
          i.is_active === 1 &&
          parseModes(i).length > 0 &&
          (i.last_shown_at === null || new Date(i.last_shown_at).getTime() < cutoff)
      )
      .slice(0, 12);
  }, [items]);

  const today = todayKey();
  const modeRows: [string, string][] = [
    ['QUICK', 'quick'],
    ['STANDARD', 'standard'],
    ['FULL', 'full'],
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>HISTORY</Text>

        {/* 本日の状況 */}
        <Text style={styles.todayLine}>
          {stats.todayDone ? '✓ 今日は完了しています' : '今日はまだ完了していません'}
        </Text>

        {/* 積み上げ(ストリークが切れてもゼロにならない) */}
        <View style={styles.statGrid}>
          <Stat label="連続" value={`${stats.streak}日`} />
          <Stat label="最長" value={`${stats.longestStreak}日`} />
          <Stat label="今月" value={`${stats.monthDone}/${stats.monthDays}日`} />
          <Stat label="直近30日" value={`${stats.rate30}%`} />
          <Stat label="累計" value={`${stats.totalDays}日`} />
        </View>

        {/* カレンダー */}
        <View style={styles.calHead}>
          <Pressable onPress={() => setMonth(prev)} hitSlop={10} accessibilityLabel="前の月">
            <Text style={styles.calNav}>‹</Text>
          </Pressable>
          <Text style={styles.calTitle}>
            {month.y}年{month.m + 1}月
          </Text>
          <Pressable onPress={() => setMonth(next)} hitSlop={10} accessibilityLabel="次の月">
            <Text style={styles.calNav}>›</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {WEEK.map((w) => (
            <Text key={w} style={styles.weekCell}>
              {w}
            </Text>
          ))}
        </View>
        <View style={styles.calGrid}>
          {grid.map((d, i) => {
            if (d === null) return <View key={i} style={styles.dayCell} />;
            const key = toDateKey(new Date(month.y, month.m, d));
            const isDone = done.has(key);
            const isToday = key === today;
            return (
              <View key={i} style={styles.dayCell}>
                <View style={[styles.dayDot, isDone && styles.dayDone, isToday && styles.dayToday]}>
                  <Text style={[styles.dayNum, isDone && styles.dayNumDone]}>{d}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* モード内訳・セッションの質 */}
        <View style={styles.block}>
          {modeRows.map(([en, key]) => (
            <View key={key} style={styles.rowLine}>
              <Text style={styles.rowLabel}>{en}</Text>
              <Text style={styles.rowValue}>{stats.modeBreakdown[key] ?? 0}回</Text>
            </View>
          ))}
          <View style={styles.rowLine}>
            <Text style={styles.rowLabel}>途中離脱</Text>
            <Text style={styles.rowValue}>{stats.abandonedCount}回</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.rowLabel}>再開して完了</Text>
            <Text style={styles.rowValue}>{stats.resumedCompletedCount}回</Text>
          </View>
        </View>

        {/* 長期間表示されていない項目 */}
        {staleItems.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>最近表示されていない項目</Text>
            {staleItems.map((i) => (
              <Text key={i.id} style={styles.staleText} numberOfLines={1}>
                ・{i.title || i.body}
              </Text>
            ))}
            <Text style={styles.staleHint}>FULLの儀式を行うか、MASTERで「毎日」に設定すると再登場します。</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );

  function prev(p: { y: number; m: number }) {
    return p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 };
  }
  function next(p: { y: number; m: number }) {
    return p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 };
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    padding: spacing.screenX,
    paddingBottom: 48,
  },
  title: {
    ...enLabel,
    fontSize: 20,
    color: colors.ink,
  },
  todayLine: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 10,
    marginBottom: 18,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 26,
  },
  stat: {
    minWidth: 86,
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.enSemi,
    fontSize: 17,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
    marginTop: 3,
  },
  calHead: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 10,
  },
  calNav: {
    fontSize: 22,
    color: colors.blue,
    paddingHorizontal: 8,
  },
  calTitle: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    color: colors.ink,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
    paddingVertical: 4,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 26,
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDone: {
    backgroundColor: colors.blue,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: colors.blueDeep,
  },
  dayNum: {
    fontFamily: fonts.en,
    fontSize: 12,
    color: colors.inkSoft,
  },
  dayNumDone: {
    color: colors.white,
  },
  block: {
    marginBottom: 24,
  },
  blockTitle: {
    fontFamily: fonts.jpBold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 8,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLabel: {
    fontFamily: fonts.jp,
    fontSize: 13,
    color: colors.inkSoft,
  },
  rowValue: {
    fontFamily: fonts.enSemi,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  staleText: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  staleHint: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
    marginTop: 8,
  },
});
