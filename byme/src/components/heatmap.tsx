import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { formatMonthJp, toDateKey } from '../lib/dates';
import { ritualScore } from '../lib/streak';
import type { RitualDay } from '../db/types';

const LEVEL_COLORS = [colors.paper, colors.bluePale, '#B9D4E3', colors.blue];

/**
 * 月のカレンダーヒートマップ。
 * 儀式(宣言・心得・日記)の完了数 0〜3 を濃淡で表す。
 */
export function MonthHeatmap({
  year,
  month0,
  ritualDays,
}: {
  year: number;
  month0: number; // 0-11
  ritualDays: RitualDay[];
}) {
  const byDate = new Map(ritualDays.map((r) => [r.date, r]));
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const leading = first.getDay(); // 0=日曜

  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      <Text style={styles.month}>{formatMonthJp(year, month0)}</Text>
      <View style={styles.weekHeader}>
        {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={styles.cellEmpty} />;
            const key = toDateKey(new Date(year, month0, day));
            const score = ritualScore(byDate.get(key));
            return (
              <View key={di} style={[styles.cell, { backgroundColor: LEVEL_COLORS[score] }]}>
                <Text style={[styles.cellText, score === 3 && { color: colors.white }]}>{day}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CELL = 38;

const styles = StyleSheet.create({
  month: {
    fontFamily: fonts.jpBold,
    fontSize: 13,
    color: colors.inkSoft,
    marginBottom: 8,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    height: CELL,
    marginHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    flex: 1,
    height: CELL,
    marginHorizontal: 2,
  },
  cellText: {
    fontFamily: fonts.en,
    fontSize: 11,
    color: colors.inkSoft,
  },
});
