import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MonthHeatmap } from '../../components/heatmap';
import { Card, SectionLabel } from '../../components/ui';
import { useAppStore } from '../../store/useAppStore';
import { formatDateJp } from '../../lib/dates';
import { listJournal } from '../../db/queries';
import type { JournalEntry } from '../../db/types';
import { colors, fonts, spacing } from '../../theme/tokens';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function Log() {
  const db = useSQLiteContext();
  const ritualDays = useAppStore((s) => s.ritualDays);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      listJournal(db).then((rows) => {
        if (mounted) setEntries(rows);
      });
      return () => {
        mounted = false;
      };
    }, [db])
  );

  const { year, month0 } = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return { year: d.getFullYear(), month0: d.getMonth() };
  }, [monthOffset]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionLabel en="LOG" jp="きろく" />

        <Card>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setMonthOffset(monthOffset - 1)} hitSlop={10}>
              <Text style={styles.navBtn}>←</Text>
            </Pressable>
            <Text style={styles.navHint}>儀式の完了度(宣言・心得・日記)</Text>
            <Pressable
              onPress={() => setMonthOffset(Math.min(monthOffset + 1, 0))}
              hitSlop={10}
            >
              <Text style={[styles.navBtn, monthOffset === 0 && { color: colors.line }]}>→</Text>
            </Pressable>
          </View>
          <MonthHeatmap year={year} month0={month0} ritualDays={ritualDays} />
        </Card>

        <View style={{ marginTop: 20 }}>
          <SectionLabel en="JOURNAL" jp="日記の履歴" />
          {entries.length === 0 ? (
            <Card>
              <Text style={styles.empty}>まだ日記がない。今日の3行から始めよう。</Text>
            </Card>
          ) : (
            entries.map((e) => {
              const isOpen = expanded === e.date;
              return (
                <Pressable key={e.date} onPress={() => setExpanded(isOpen ? null : e.date)}>
                  <Card style={{ marginBottom: 10, gap: 8 }}>
                    <Text style={styles.entryDate}>{formatDateJp(e.date)}</Text>
                    {isOpen ? (
                      <View style={{ gap: 8 }}>
                        <EntryLine label="感謝" text={e.gratitude} />
                        <EntryLine label="前進" text={e.progress} />
                        <EntryLine label="明日" text={e.vision} />
                      </View>
                    ) : (
                      <Text style={styles.entryPreview} numberOfLines={1}>
                        {e.gratitude || e.progress || e.vision}
                      </Text>
                    )}
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EntryLine({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <View>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineText}>{text}</Text>
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
    paddingBottom: 40,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    fontFamily: fonts.enSemi,
    fontSize: 16,
    color: colors.blue,
    paddingHorizontal: 6,
  },
  navHint: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
  },
  empty: {
    fontFamily: fonts.jp,
    fontSize: 13,
    color: colors.mist,
  },
  entryDate: {
    fontFamily: fonts.enSemi,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.blueDeep,
  },
  entryPreview: {
    fontFamily: fonts.jp,
    fontSize: 13,
    color: colors.inkSoft,
  },
  lineLabel: {
    fontFamily: fonts.jpBold,
    fontSize: 11,
    color: colors.mist,
    marginBottom: 2,
  },
  lineText: {
    fontFamily: fonts.jp,
    fontSize: 13,
    lineHeight: 22,
    color: colors.ink,
  },
});
