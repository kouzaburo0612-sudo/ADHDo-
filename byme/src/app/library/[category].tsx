import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, GhostButton, PrimaryButton } from '../../components/ui';
import { todaysPrinciple, useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

/**
 * 心得カテゴリ詳細。
 * 項目ごとに「読んだ」(日次)・オン/オフ・編集・削除。新規追加も可能。
 */
export default function LibraryCategory() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = category ?? '';

  const principles = useAppStore((s) => s.principles);
  const readsToday = useAppStore((s) => s.readsToday);
  const markRead = useAppStore((s) => s.markRead);
  const togglePrinciple = useAppStore((s) => s.togglePrinciple);
  const addPrinciple = useAppStore((s) => s.addPrinciple);
  const editPrinciple = useAppStore((s) => s.editPrinciple);
  const removePrinciple = useAppStore((s) => s.removePrinciple);
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);

  const items = principles.filter((p) => p.category === cat);
  const today = todaysPrinciple(principles);
  const readCount = items.filter((p) => readsToday.principle.includes(p.id)).length;

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState('');

  const save = async () => {
    const text = draft.trim();
    if (!text) return;
    if (editingId === 'new') {
      await addPrinciple(cat, text);
    } else if (typeof editingId === 'number') {
      await editPrinciple(editingId, text);
    }
    await refreshNotifications();
    setEditingId(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* ヘッダー */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={styles.back}>‹ MIND</Text>
            </Pressable>
            <Text style={styles.readCount}>
              今日 {readCount}/{items.length}
            </Text>
          </View>
          <Text style={styles.title}>{cat}</Text>

          {/* 項目リスト */}
          <View style={styles.card}>
            {items.map((p) => {
              const isRead = readsToday.principle.includes(p.id);
              if (editingId === p.id) {
                return (
                  <View key={p.id} style={styles.editBox}>
                    <Field multiline value={draft} onChangeText={setDraft} autoFocus />
                    <View style={styles.editActions}>
                      <GhostButton
                        title="削除"
                        onPress={async () => {
                          await removePrinciple(p.id);
                          await refreshNotifications();
                          setEditingId(null);
                        }}
                        style={{ flex: 1 }}
                      />
                      <PrimaryButton title="保存" onPress={save} style={{ flex: 1 }} />
                    </View>
                  </View>
                );
              }
              return (
                <View key={p.id} style={[styles.row, p.active === 0 && { opacity: 0.4 }]}>
                  {/* 読んだボタン */}
                  <Pressable
                    style={[styles.readBtn, isRead && styles.readBtnOn]}
                    hitSlop={6}
                    onPress={() => markRead('principle', p.id, !isRead)}
                  >
                    <Text style={[styles.readTri, isRead && styles.readTriOn]}>▼</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      setDraft(p.text);
                      setEditingId(p.id);
                    }}
                  >
                    <Text style={[styles.itemText, isRead && styles.itemTextRead]}>{p.text}</Text>
                    {today?.id === p.id ? <Text style={styles.todayBadge}>TODAY</Text> : null}
                  </Pressable>
                  <Switch
                    value={p.active === 1}
                    onValueChange={async (v) => {
                      await togglePrinciple(p.id, v);
                      await refreshNotifications();
                    }}
                    trackColor={{ true: colors.blue, false: colors.line }}
                  />
                </View>
              );
            })}

            {/* 追加 */}
            {editingId === 'new' ? (
              <View style={styles.editBox}>
                <Field multiline value={draft} onChangeText={setDraft} placeholder="新しい心得(1項目=1文)" autoFocus />
                <View style={styles.editActions}>
                  <GhostButton title="やめる" onPress={() => setEditingId(null)} style={{ flex: 1 }} />
                  <PrimaryButton title="追加" onPress={save} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <GhostButton
                title="＋ 心得を追加"
                onPress={() => {
                  setDraft('');
                  setEditingId('new');
                }}
                style={{ marginVertical: 12 }}
              />
            )}
          </View>

          {/* 全部読んだ */}
          {items.length > 0 && readCount < items.length ? (
            <PrimaryButton
              title="ALL READ / すべて読んだ"
              onPress={async () => {
                for (const p of items) {
                  if (!readsToday.principle.includes(p.id)) {
                    await markRead('principle', p.id, true);
                  }
                }
              }}
              style={{ marginTop: 14 }}
            />
          ) : null}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  back: {
    fontFamily: fonts.enSemi,
    fontSize: 14,
    letterSpacing: 1.5,
    color: colors.blue,
  },
  readCount: {
    fontFamily: fonts.en,
    fontSize: 12,
    color: colors.mist,
  },
  title: {
    fontFamily: fonts.jpBlack,
    fontSize: 22,
    color: colors.ink,
    marginTop: 12,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  readBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readBtnOn: {
    backgroundColor: colors.bluePale,
    borderColor: colors.blue,
  },
  readTri: {
    fontSize: 10,
    color: colors.line,
  },
  readTriOn: {
    color: colors.blue,
  },
  itemText: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  itemTextRead: {
    color: colors.ink,
  },
  todayBadge: {
    ...enLabel,
    fontSize: 9,
    color: colors.blueDeep,
    backgroundColor: colors.bluePale,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  editBox: {
    gap: 8,
    backgroundColor: colors.paper,
    borderRadius: 12,
    padding: 10,
    marginVertical: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
});
