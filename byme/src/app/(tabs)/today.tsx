import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { Tri, TriProgress } from '../../components/tri';
import { Card, Field, GhostButton, PrimaryButton, SectionLabel } from '../../components/ui';
import { daysUntil } from '../../lib/dates';
import {
  activeAffirmations,
  todaysPrinciple,
  useAppStore,
} from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

export default function Today() {
  const settings = useAppStore((s) => s.settings);
  const goals = useAppStore((s) => s.goals);
  const affirmations = useAppStore((s) => s.affirmations);
  const principles = useAppStore((s) => s.principles);
  const ritual = useAppStore((s) => s.todayRitual);
  const journal = useAppStore((s) => s.todayJournal);
  const streak = useAppStore((s) => s.streak);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const markRitual = useAppStore((s) => s.markRitual);
  const saveJournal = useAppStore((s) => s.saveJournal);

  const identity = settings.identity ?? '私は、人生を自分の手で創る人間である。';
  const principle = todaysPrinciple(principles);
  const activeCount = activeAffirmations(affirmations).length;
  const doneCount = (ritual.declared ? 1 : 0) + (ritual.principle ? 1 : 0) + (ritual.journal ? 1 : 0);
  const allDone = doneCount === 3;

  // 期日カウントダウンチップ(近い順に最大2つ)
  const countdowns = useMemo(
    () =>
      goals
        .filter((g) => g.deadline !== null && daysUntil(g.deadline!) >= 0)
        .sort((a, b) => daysUntil(a.deadline!) - daysUntil(b.deadline!))
        .slice(0, 2),
    [goals]
  );

  // アイデンティティのインライン編集
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityDraft, setIdentityDraft] = useState('');

  // 日記
  const [gratitude, setGratitude] = useState(journal?.gratitude ?? '');
  const [progress, setProgress] = useState(journal?.progress ?? '');
  const [vision, setVision] = useState(journal?.vision ?? '');
  const [journalOpen, setJournalOpen] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* ヘッダー */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logo}>BYME</Text>
              <Tri size={7} color={colors.blue} style={{ marginTop: 2 }} />
            </View>
            <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
              <Text style={styles.settingsLink}>設定</Text>
            </Pressable>
          </View>

          {/* アイデンティティ宣言文(タップで編集) */}
          {editingIdentity ? (
            <Card style={{ gap: 10 }}>
              <Field
                multiline
                value={identityDraft}
                onChangeText={setIdentityDraft}
                style={styles.identityField}
                autoFocus
              />
              <PrimaryButton
                title="保存"
                onPress={async () => {
                  await saveSetting('identity', identityDraft.trim());
                  setEditingIdentity(false);
                }}
              />
            </Card>
          ) : (
            <Pressable
              onPress={() => {
                setIdentityDraft(identity);
                setEditingIdentity(true);
              }}
            >
              <Text style={styles.identity}>{identity}</Text>
            </Pressable>
          )}

          {/* ストリーク + カウントダウン */}
          <View style={styles.chipRow}>
            <View style={styles.streakChip}>
              <Tri size={8} color={colors.blue} />
              <Text style={styles.streakText}>
                {streak}
                <Text style={styles.streakUnit}> 日連続</Text>
              </Text>
            </View>
            {countdowns.map((g) => (
              <View key={g.id} style={styles.countChip}>
                <Text style={styles.countLabel} numberOfLines={1}>
                  DAYS TO {g.deadline!.slice(0, 4)}
                </Text>
                <Text style={styles.countValue}>{daysUntil(g.deadline!)}</Text>
              </View>
            ))}
          </View>

          <TriProgress total={3} done={doneCount} size={10} />

          {allDone ? (
            <Card style={styles.completeCard}>
              <Text style={styles.completeEn}>TODAY COMPLETE</Text>
              <Text style={styles.completeJp}>今日も、なりたい自分に近づいた。</Text>
            </Card>
          ) : null}

          {/* BE / 宣言 */}
          <Card style={styles.section}>
            <SectionLabel en="BE" jp="宣言" />
            <Text style={styles.sectionBody}>
              {ritual.declared
                ? 'DECLARED — 今日の宣言は完了。'
                : `${activeCount}件の宣言を、声に出して唱える。`}
            </Text>
            {ritual.declared ? (
              <GhostButton title="もう一度唱える" onPress={() => router.push('/declare-mode')} />
            ) : (
              <PrimaryButton
                title="DECLARE / 宣言をはじめる"
                onPress={() => router.push('/declare-mode')}
                disabled={activeCount === 0}
              />
            )}
          </Card>

          {/* MIND / 今日の心得 */}
          <Card style={styles.section}>
            <SectionLabel en="MIND" jp="今日の心得" />
            {principle ? (
              <>
                <Text style={styles.principleText}>{principle.text}</Text>
                {principle.source ? <Text style={styles.principleSource}>— {principle.source}</Text> : null}
                {ritual.principle ? (
                  <Text style={styles.doneNote}>今日の心得は胸に刻んだ。</Text>
                ) : (
                  <PrimaryButton title="ENGRAVE / 胸に刻んだ" onPress={() => markRitual('principle')} />
                )}
              </>
            ) : (
              <Text style={styles.sectionBody}>アクティブな心得がない。MINDタブで追加しよう。</Text>
            )}
          </Card>

          {/* LOG / 日記 */}
          <Card style={styles.section}>
            <SectionLabel en="LOG" jp="日記" />
            {ritual.journal && !journalOpen ? (
              <>
                <Text style={styles.doneNote}>今日の3行は記録済み。</Text>
                <GhostButton title="書き直す" onPress={() => setJournalOpen(true)} />
              </>
            ) : (
              <View style={{ gap: 10 }}>
                <Field
                  multiline
                  value={gratitude}
                  onChangeText={setGratitude}
                  placeholder="感謝 — 今日ありがたかったこと"
                  style={styles.journalField}
                />
                <Field
                  multiline
                  value={progress}
                  onChangeText={setProgress}
                  placeholder="前進 — 目標に近づいた一歩"
                  style={styles.journalField}
                />
                <Field
                  multiline
                  value={vision}
                  onChangeText={setVision}
                  placeholder="明日 — 明日の自分がやること"
                  style={styles.journalField}
                />
                <PrimaryButton
                  title="SAVE / 今日を刻む"
                  onPress={async () => {
                    await saveJournal({ gratitude, progress, vision });
                    setJournalOpen(false);
                  }}
                  disabled={!gratitude.trim() && !progress.trim() && !vision.trim()}
                />
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
  },
  logo: {
    fontFamily: fonts.enBold,
    fontSize: 18,
    letterSpacing: 5,
    color: colors.ink,
  },
  settingsLink: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.mist,
  },
  identity: {
    fontFamily: fonts.jpBlack,
    fontSize: 20,
    lineHeight: 32,
    color: colors.ink,
  },
  identityField: {
    fontFamily: fonts.jpBlack,
    fontSize: 17,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakText: {
    fontFamily: fonts.enSemi,
    fontSize: 14,
    color: colors.ink,
  },
  streakUnit: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bluePale,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countLabel: {
    ...enLabel,
    fontSize: 9,
    color: colors.blueDeep,
  },
  countValue: {
    fontFamily: fonts.enSemi,
    fontSize: 14,
    color: colors.blueDeep,
  },
  completeCard: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    alignItems: 'center',
    gap: 6,
  },
  completeEn: {
    ...enLabel,
    fontSize: 13,
    color: colors.white,
  },
  completeJp: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.bluePale,
  },
  section: {
    gap: 12,
  },
  sectionBody: {
    fontFamily: fonts.jp,
    fontSize: 13,
    lineHeight: 21,
    color: colors.inkSoft,
  },
  principleText: {
    fontFamily: fonts.jpBold,
    fontSize: 16,
    lineHeight: 27,
    color: colors.ink,
  },
  principleSource: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  doneNote: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    color: colors.blueDeep,
  },
  journalField: {
    minHeight: 64,
  },
});
