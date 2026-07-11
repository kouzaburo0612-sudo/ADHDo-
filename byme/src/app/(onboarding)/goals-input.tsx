import { router } from 'expo-router';
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
import { Card, Chip, Field, GhostButton, PrimaryButton, SectionLabel, TriListRow } from '../../components/ui';
import { GOAL_CATEGORIES, GOAL_CATEGORY_LABELS, type GoalCategory } from '../../db/types';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { colors, fonts, spacing } from '../../theme/tokens';

export default function GoalsInput() {
  const { goals, addGoal, removeGoal } = useOnboardingStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GoalCategory>('short');
  const [deadline, setDeadline] = useState('');

  const add = () => {
    const t = title.trim();
    if (!t) return;
    const d = deadline.trim();
    addGoal({
      title: t,
      category,
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
    });
    setTitle('');
    setDeadline('');
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SectionLabel en="GOALS" jp="目標" />
          <Text style={styles.lead}>
            達成したいことを自由に書く(複数可)。{'\n'}次のステップでAIが「宣言文」に変換する。
          </Text>

          <Card style={{ gap: spacing.gap }}>
            <Field
              value={title}
              onChangeText={setTitle}
              placeholder="例: 2026年までに年商1億円を達成する"
            />
            <View style={styles.chipRow}>
              {GOAL_CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => setCategory(c)}>
                  <Chip
                    text={`${GOAL_CATEGORY_LABELS[c].en} ${GOAL_CATEGORY_LABELS[c].jp}`}
                    active={category === c}
                  />
                </Pressable>
              ))}
            </View>
            <Field
              value={deadline}
              onChangeText={setDeadline}
              placeholder="期日(任意・YYYY-MM-DD)"
              autoCapitalize="none"
            />
            <GhostButton title="＋ 追加する" onPress={add} disabled={title.trim().length === 0} />
          </Card>

          {goals.length > 0 ? (
            <Card style={{ marginTop: 16, gap: 10 }}>
              {goals.map((g, i) => (
                <TriListRow key={`${g.title}-${i}`}>
                  <View style={styles.goalRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goalTitle}>{g.title}</Text>
                      <Text style={styles.goalMeta}>
                        {GOAL_CATEGORY_LABELS[g.category].jp}
                        {g.deadline ? ` ・ ${g.deadline}` : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeGoal(i)} hitSlop={8}>
                      <Text style={styles.remove}>削除</Text>
                    </Pressable>
                  </View>
                </TriListRow>
              ))}
            </Card>
          ) : null}

          <PrimaryButton
            title="NEXT / 宣言文に変換する"
            onPress={() => router.push('/(onboarding)/ai-convert')}
            disabled={goals.length === 0}
            style={{ marginTop: 20 }}
          />
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
    paddingBottom: 48,
  },
  lead: {
    fontFamily: fonts.jp,
    fontSize: 13,
    lineHeight: 22,
    color: colors.inkSoft,
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalTitle: {
    fontFamily: fonts.jpMedium,
    fontSize: 14,
    color: colors.ink,
  },
  goalMeta: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
    marginTop: 2,
  },
  remove: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.mist,
  },
});
