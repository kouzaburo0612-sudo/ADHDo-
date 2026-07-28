import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, PrimaryButton } from '../../components/ui';
import {
  LIFE_GOALS,
  QUEST_CATEGORIES,
  QUEST_REWARD_CATEGORY,
  ROADMAP,
  ROADMAP_STRATEGY,
} from '../../data/master';
import type { SettingKey } from '../../db/types';
import { useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

/** VISION = 未来(ロードマップ・到達点・MVV)+ 年間クエストの2セグメント */
export default function Vision() {
  const [segment, setSegment] = useState<'vision' | 'quest'>('vision');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* セグメント切替 */}
      <View style={styles.segment}>
        {(
          [
            { key: 'vision', label: '未来' },
            { key: 'quest', label: '年間クエスト' },
          ] as const
        ).map((s) => (
          <Pressable
            key={s.key}
            style={[styles.segBtn, segment === s.key && styles.segBtnOn]}
            onPress={() => setSegment(s.key)}
          >
            <Text style={[styles.segText, segment === s.key && styles.segTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      {segment === 'vision' ? <VisionSegment /> : <QuestSegment />}
    </SafeAreaView>
  );
}

// ---------- 未来 ----------

const MVV_KEYS: { key: SettingKey; en: string; jp: string }[] = [
  { key: 'identity', en: 'IDENTITY', jp: 'アイデンティティ' },
  { key: 'mvv_mission', en: 'MISSION', jp: '使命' },
  { key: 'mvv_vision', en: 'VISION', jp: '未来' },
  { key: 'mvv_values_company', en: 'VALUES', jp: '行動指針(会社)' },
  { key: 'theme_2026', en: 'THEME 2026', jp: '今年のテーマ' },
];

function VisionSegment() {
  const settings = useAppStore((s) => s.settings);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const [editing, setEditing] = useState<SettingKey | null>(null);
  const [draft, setDraft] = useState('');
  const currentYear = new Date().getFullYear();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>FINAL DESTINATION</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroNum}>6,500</Text>
            <Text style={styles.heroUnit}>億円 — 2034</Text>
          </View>
          <Text style={styles.heroSub}>離島から、1兆円へ。</Text>
        </View>

        <Text style={styles.strategy}>{ROADMAP_STRATEGY}</Text>
        <View style={styles.rmWrap}>
          {ROADMAP.map((r, i) => {
            const isNow = r.year === currentYear;
            const isPast = r.year < currentYear;
            return (
              <View key={r.year} style={styles.rmItem}>
                {i < ROADMAP.length - 1 ? <View style={styles.rmLine} /> : null}
                <View style={[styles.rmDot, isNow && styles.rmDotNow, isPast && styles.rmDotPast]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rmHead}>
                    <Text style={[styles.rmYear, isNow && { color: colors.blue }]}>{r.year}</Text>
                    <Text style={styles.rmAge}>{r.age}歳</Text>
                    {isNow ? (
                      <View style={styles.nowBadge}>
                        <Text style={styles.nowBadgeText}>NOW</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rmRev}>
                    売上 {r.rev} / EBITDA {r.ebitda}
                  </Text>
                  {r.note ? <Text style={styles.rmNote}>{r.note}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.secLabel}>LIFE GOALS — 人生の到達点</Text>
          <View style={styles.card}>
            {LIFE_GOALS.map((g, i) => (
              <View key={i} style={styles.goalRow}>
                <Text style={styles.goalMark}>▸</Text>
                <Text style={styles.goalText}>{g}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.secLabel}>MVV</Text>
          {MVV_KEYS.map(({ key, en, jp }) => {
            const value = settings[key] ?? '';
            const isEditing = editing === key;
            return (
              <View key={key} style={styles.card}>
                <View style={styles.mvvHead}>
                  <Text style={styles.mvvEn}>{en}</Text>
                  <Text style={styles.mvvJp}>{jp}</Text>
                </View>
                {isEditing ? (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <Field multiline value={draft} onChangeText={setDraft} autoFocus />
                    <PrimaryButton
                      title="保存"
                      onPress={async () => {
                        await saveSetting(key, draft.trim());
                        setEditing(null);
                      }}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setDraft(value);
                      setEditing(key);
                    }}
                  >
                    <Text style={styles.mvvText}>{value || 'タップして書く'}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- 年間クエスト ----------

function QuestSegment() {
  const quests = useAppStore((s) => s.quests);
  const toggleQuest = useAppStore((s) => s.toggleQuest);

  const total = quests.length;
  const doneTotal = quests.filter((x) => x.done === 1).length;

  return (
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
            <View style={[styles.card, { paddingVertical: 4, paddingHorizontal: 14 }]}>
              {items.map((it) => {
                const isDone = it.done === 1;
                return (
                  <Pressable key={it.id} style={styles.qRow} onPress={() => toggleQuest(it.id, !isDone)}>
                    <View style={[styles.qBox, isDone && styles.qBoxDone]}>
                      {isDone ? <Text style={styles.qBoxCheck}>✓</Text> : null}
                    </View>
                    <Text style={[styles.qTitle, isDone && styles.qTitleDone]}>{it.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.screenX,
    marginTop: 12,
    backgroundColor: colors.line,
    borderRadius: 10,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segBtnOn: {
    backgroundColor: colors.white,
  },
  segText: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.mist,
  },
  segTextOn: {
    color: colors.ink,
    fontFamily: fonts.jpBold,
  },
  scroll: {
    paddingBottom: 40,
  },
  hero: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
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
  heroSub: {
    fontFamily: fonts.jpBold,
    fontSize: 12,
    color: colors.red,
    marginTop: 2,
  },
  strategy: {
    fontFamily: fonts.jp,
    fontSize: 11,
    lineHeight: 18,
    color: colors.mist,
    paddingHorizontal: spacing.screenX,
    marginTop: 10,
    marginBottom: 14,
  },
  rmWrap: {
    paddingHorizontal: spacing.screenX,
  },
  rmItem: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 22,
    position: 'relative',
  },
  rmLine: {
    position: 'absolute',
    left: 7,
    top: 18,
    bottom: 0,
    width: 2,
    backgroundColor: colors.line,
  },
  rmDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: colors.white,
    marginTop: 3,
    zIndex: 1,
  },
  rmDotNow: {
    borderColor: colors.blue,
    backgroundColor: colors.blue,
  },
  rmDotPast: {
    borderColor: colors.blue,
  },
  rmHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rmYear: {
    fontFamily: fonts.enSemi,
    fontSize: 18,
    letterSpacing: 1.2,
    color: colors.ink,
  },
  rmAge: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  nowBadge: {
    backgroundColor: colors.blue,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  nowBadgeText: {
    ...enLabel,
    fontSize: 9,
    color: colors.white,
  },
  rmRev: {
    fontFamily: fonts.en,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 2,
  },
  rmNote: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 20,
    color: colors.mist,
    marginTop: 3,
  },
  section: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
  },
  secLabel: {
    ...enLabel,
    fontSize: 11,
    color: colors.mist,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  goalRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 5,
  },
  goalMark: {
    color: colors.blue,
    fontSize: 13,
    lineHeight: 22,
  },
  goalText: {
    flex: 1,
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  mvvHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  mvvEn: {
    ...enLabel,
    fontSize: 12,
    color: colors.blue,
  },
  mvvJp: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  mvvText: {
    fontFamily: fonts.jpMedium,
    fontSize: 14,
    lineHeight: 24,
    color: colors.ink,
    marginTop: 8,
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
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  qBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qBoxDone: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  qBoxCheck: {
    color: colors.white,
    fontSize: 12,
    fontFamily: fonts.jpBold,
  },
  qTitle: {
    flex: 1,
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
  },
  qTitleDone: {
    color: colors.mist,
    textDecorationLine: 'line-through',
  },
});
