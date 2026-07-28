import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QUEST_CATEGORIES, QUEST_REWARD_CATEGORY } from '../../data/master';
import { useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

/** 年間クエスト: カテゴリ別チェックリスト+達成率(仕様§5) */
export default function Quest() {
  const quests = useAppStore((s) => s.quests);
  const toggleQuest = useAppStore((s) => s.toggleQuest);

  const total = quests.length;
  const doneTotal = quests.filter((x) => x.done === 1).length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>2026 QUESTS</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroNum}>{doneTotal}</Text>
            <Text style={styles.heroUnit}>/ {total} CLEAR</Text>
          </View>
        </View>

        {QUEST_CATEGORIES.map((cat) => {
          const items = quests.filter((x) => x.category === cat);
          if (items.length === 0) return null;
          const done = items.filter((x) => x.done === 1).length;
          const pct = Math.round((done / items.length) * 100);
          const isReward = cat === QUEST_REWARD_CATEGORY;
          return (
            <View key={cat} style={styles.section}>
              <View style={styles.catHead}>
                <Text style={styles.catName}>{cat}</Text>
                {isReward ? (
                  <View style={styles.rewardBadge}>
                    <Text style={styles.rewardText}>ご褒美枠</Text>
                  </View>
                ) : null}
                <Text style={styles.catRate}>
                  {done}/{items.length}({pct}%)
                </Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
              {isReward ? (
                <Text style={styles.rewardNote}>コントロールの上でのご褒美枠。戒めを守った者だけが取りにいける報酬。</Text>
              ) : null}
              <View style={styles.card}>
                {items.map((it) => {
                  const isDone = it.done === 1;
                  return (
                    <Pressable
                      key={it.id}
                      style={styles.row}
                      onPress={() => toggleQuest(it.id, !isDone)}
                    >
                      <View style={[styles.box, isDone && styles.boxDone]}>
                        {isDone ? <Text style={styles.boxCheck}>✓</Text> : null}
                      </View>
                      <Text style={[styles.title, isDone && styles.titleDone]}>{it.title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    paddingBottom: 40,
  },
  hero: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
  },
  heroLabel: {
    ...enLabel,
    fontSize: 11,
    color: colors.mist,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  heroNum: {
    fontFamily: fonts.enSemi,
    fontSize: 56,
    lineHeight: 64,
    color: colors.ink,
  },
  heroUnit: {
    fontFamily: fonts.en,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.mist,
  },
  section: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 18,
  },
  catHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catName: {
    fontFamily: fonts.jpBold,
    fontSize: 15,
    color: colors.ink,
  },
  rewardBadge: {
    backgroundColor: colors.bluePale,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  rewardText: {
    fontFamily: fonts.jpMedium,
    fontSize: 10,
    color: colors.blueDeep,
  },
  catRate: {
    marginLeft: 'auto',
    fontFamily: fonts.en,
    fontSize: 12,
    color: colors.mist,
  },
  bar: {
    height: 5,
    backgroundColor: colors.bluePale,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.blue,
    borderRadius: 3,
  },
  rewardNote: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  boxCheck: {
    color: colors.white,
    fontSize: 12,
    fontFamily: fonts.jpBold,
  },
  title: {
    flex: 1,
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
  },
  titleDone: {
    color: colors.mist,
    textDecorationLine: 'line-through',
  },
});
