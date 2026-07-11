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
import { Tri } from '../../components/tri';
import { Card, Chip, Field, GhostButton, PrimaryButton, SectionLabel } from '../../components/ui';
import {
  GOAL_CATEGORIES,
  GOAL_CATEGORY_LABELS,
  type Goal,
  type GoalCategory,
} from '../../db/types';
import { convertGoals } from '../../lib/ai';
import { daysUntil } from '../../lib/dates';
import { useAppStore } from '../../store/useAppStore';
import { colors, fonts, spacing } from '../../theme/tokens';

const MVV_KEYS = [
  { key: 'mvv_mission', en: 'MISSION', jp: '使命' },
  { key: 'mvv_vision', en: 'VISION', jp: '未来の姿' },
  { key: 'mvv_value', en: 'VALUE', jp: '行動指針' },
] as const;

export default function Vision() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <MvvSection />
          <GoalsSection />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- MVV ----------

function MvvSection() {
  const settings = useAppStore((s) => s.settings);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <View style={{ gap: 12 }}>
      {MVV_KEYS.map(({ key, en, jp }) => {
        const value = settings[key] ?? '';
        const isEditing = editing === key;
        return (
          <Card key={key} style={{ gap: 8 }}>
            <SectionLabel en={en} jp={jp} />
            {isEditing ? (
              <>
                <Field multiline value={draft} onChangeText={setDraft} autoFocus />
                <PrimaryButton
                  title="保存"
                  onPress={async () => {
                    await saveSetting(key, draft.trim());
                    setEditing(null);
                  }}
                />
              </>
            ) : (
              <Pressable
                onPress={() => {
                  setDraft(value);
                  setEditing(key);
                }}
              >
                <Text style={value ? styles.mvvText : styles.mvvEmpty}>
                  {value || 'タップして書く'}
                </Text>
              </Pressable>
            )}
          </Card>
        );
      })}
    </View>
  );
}

// ---------- 目標 ----------

function GoalsSection() {
  const goals = useAppStore((s) => s.goals);
  const settings = useAppStore((s) => s.settings);
  const addGoal = useAppStore((s) => s.addGoal);
  const editGoal = useAppStore((s) => s.editGoal);
  const removeGoal = useAppStore((s) => s.removeGoal);
  const addAffirmation = useAppStore((s) => s.addAffirmation);

  const [open, setOpen] = useState<Record<GoalCategory, boolean>>({
    short: true,
    mid: false,
    long: false,
    life: false,
  });
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [newCategory, setNewCategory] = useState<GoalCategory>('short');
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [convertingId, setConvertingId] = useState<number | null>(null);

  const startEdit = (g: Goal) => {
    setEditingId(g.id);
    setTitle(g.title);
    setDeadline(g.deadline ?? '');
  };

  const startNew = (category: GoalCategory) => {
    setEditingId('new');
    setNewCategory(category);
    setTitle('');
    setDeadline('');
  };

  const save = async (category: GoalCategory) => {
    const d = deadline.trim();
    const payload = {
      title: title.trim(),
      category,
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
    };
    if (!payload.title) return;
    if (editingId === 'new') {
      await addGoal(payload);
    } else if (typeof editingId === 'number') {
      await editGoal(editingId, payload);
    }
    setEditingId(null);
  };

  const toAffirmation = async (g: Goal) => {
    setConvertingId(g.id);
    try {
      const res = await convertGoals([g.title], settings.ai_endpoint);
      const conv = res.data[0];
      if (conv) {
        await addAffirmation({ text: conv.affirmation, tag: null, goal_id: g.id });
      }
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <View style={{ marginTop: 20, gap: 12 }}>
      <SectionLabel en="GOALS" jp="目標" />
      {GOAL_CATEGORIES.map((category) => {
        const items = goals.filter((g) => g.category === category);
        const isOpen = open[category];
        return (
          <Card key={category} style={{ gap: 10 }}>
            <Pressable
              style={styles.accordionHeader}
              onPress={() => setOpen({ ...open, [category]: !isOpen })}
            >
              <Tri size={9} color={isOpen ? colors.blue : colors.line} />
              <Text style={styles.accordionEn}>{GOAL_CATEGORY_LABELS[category].en}</Text>
              <Text style={styles.accordionJp}>{GOAL_CATEGORY_LABELS[category].jp}</Text>
              <Text style={styles.accordionCount}>{items.length}</Text>
            </Pressable>

            {isOpen ? (
              <View style={{ gap: 12 }}>
                {items.map((g) =>
                  editingId === g.id ? (
                    <View key={g.id} style={styles.editBox}>
                      <Field value={title} onChangeText={setTitle} placeholder="目標" />
                      <Field
                        value={deadline}
                        onChangeText={setDeadline}
                        placeholder="期日(任意・YYYY-MM-DD)"
                        autoCapitalize="none"
                      />
                      <View style={styles.editActions}>
                        <GhostButton title="アーカイブ" onPress={async () => { await removeGoal(g.id); setEditingId(null); }} style={{ flex: 1 }} />
                        <PrimaryButton title="保存" onPress={() => save(category)} style={{ flex: 1 }} />
                      </View>
                    </View>
                  ) : (
                    <View key={g.id} style={styles.goalRow}>
                      <Text style={styles.goalMark}>▸</Text>
                      <Pressable style={{ flex: 1 }} onPress={() => startEdit(g)}>
                        <Text style={styles.goalTitle}>{g.title}</Text>
                        {g.deadline ? (
                          <Text style={styles.goalMeta}>
                            {g.deadline} ・ あと{Math.max(daysUntil(g.deadline), 0)}日
                          </Text>
                        ) : null}
                      </Pressable>
                      <Pressable
                        onPress={() => toAffirmation(g)}
                        disabled={convertingId !== null}
                        hitSlop={8}
                      >
                        <Chip text={convertingId === g.id ? '変換中…' : '宣言に'} active />
                      </Pressable>
                    </View>
                  )
                )}

                {editingId === 'new' && newCategory === category ? (
                  <View style={styles.editBox}>
                    <Field value={title} onChangeText={setTitle} placeholder="目標" autoFocus />
                    <Field
                      value={deadline}
                      onChangeText={setDeadline}
                      placeholder="期日(任意・YYYY-MM-DD)"
                      autoCapitalize="none"
                    />
                    <View style={styles.editActions}>
                      <GhostButton title="やめる" onPress={() => setEditingId(null)} style={{ flex: 1 }} />
                      <PrimaryButton title="追加" onPress={() => save(category)} style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : (
                  <GhostButton title="＋ 目標を追加" onPress={() => startNew(category)} />
                )}
              </View>
            ) : null}
          </Card>
        );
      })}
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
  mvvText: {
    fontFamily: fonts.jpMedium,
    fontSize: 14,
    lineHeight: 24,
    color: colors.ink,
  },
  mvvEmpty: {
    fontFamily: fonts.jp,
    fontSize: 13,
    color: colors.mist,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionEn: {
    fontFamily: fonts.enSemi,
    letterSpacing: 2,
    fontSize: 13,
    color: colors.ink,
  },
  accordionJp: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  accordionCount: {
    marginLeft: 'auto',
    fontFamily: fonts.en,
    fontSize: 12,
    color: colors.mist,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalMark: {
    color: colors.blue,
    fontSize: 13,
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
  editBox: {
    gap: 8,
    backgroundColor: colors.paper,
    borderRadius: 12,
    padding: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
});
