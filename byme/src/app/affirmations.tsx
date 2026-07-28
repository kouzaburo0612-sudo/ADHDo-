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
import { Field, GhostButton, PrimaryButton } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../theme/tokens';

/**
 * アファメーション一覧。
 * 各篇に「唱えた」(日次)・編集・削除。新規追加と全画面唱和モードへの導線。
 */
export default function Affirmations() {
  const affirmations = useAppStore((s) => s.affirmations);
  const readsToday = useAppStore((s) => s.readsToday);
  const markRead = useAppStore((s) => s.markRead);
  const addAffirmation = useAppStore((s) => s.addAffirmation);
  const editAffirmation = useAppStore((s) => s.editAffirmation);
  const removeAffirmation = useAppStore((s) => s.removeAffirmation);

  const readCount = affirmations.filter((a) => readsToday.affirmation.includes(a.id)).length;

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const save = async () => {
    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!body) return;
    if (editingId === 'new') {
      await addAffirmation(title || `⑥ 追加`, body);
    } else if (typeof editingId === 'number') {
      await editAffirmation(editingId, title, body);
    }
    setEditingId(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={styles.back}>‹ MIND</Text>
            </Pressable>
            <Text style={styles.readCount}>
              今日 {readCount}/{affirmations.length}
            </Text>
          </View>
          <Text style={styles.title}>AFFIRMATIONS</Text>

          <Pressable style={styles.reciteBtn} onPress={() => router.push('/recite')}>
            <View style={styles.playTri} />
            <Text style={styles.reciteText}>1篇ずつ全画面で唱える</Text>
          </Pressable>

          {affirmations.map((a) => {
            const isRead = readsToday.affirmation.includes(a.id);
            if (editingId === a.id) {
              return (
                <View key={a.id} style={styles.editBox}>
                  <Field value={draftTitle} onChangeText={setDraftTitle} placeholder="タイトル" />
                  <Field multiline value={draftBody} onChangeText={setDraftBody} style={{ minHeight: 120 }} />
                  <View style={styles.editActions}>
                    <GhostButton
                      title="削除"
                      onPress={async () => {
                        await removeAffirmation(a.id);
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
              <View key={a.id} style={[styles.card, isRead && styles.cardRead]}>
                <Pressable
                  onPress={() => {
                    setDraftTitle(a.title);
                    setDraftBody(a.body);
                    setEditingId(a.id);
                  }}
                >
                  <Text style={styles.affTitle}>{a.title}</Text>
                  <Text style={styles.affBody}>{a.body}</Text>
                </Pressable>
                <Pressable
                  style={[styles.readBtn, isRead && styles.readBtnOn]}
                  onPress={() => markRead('affirmation', a.id, !isRead)}
                >
                  <Text style={[styles.readBtnText, isRead && styles.readBtnTextOn]}>
                    {isRead ? '✓ 今日唱えた' : '唱えた'}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          {editingId === 'new' ? (
            <View style={styles.editBox}>
              <Field value={draftTitle} onChangeText={setDraftTitle} placeholder="タイトル(例: ⑥ 家族)" autoFocus />
              <Field
                multiline
                value={draftBody}
                onChangeText={setDraftBody}
                placeholder="本文(現在進行形・完了形で)"
                style={{ minHeight: 120 }}
              />
              <View style={styles.editActions}>
                <GhostButton title="やめる" onPress={() => setEditingId(null)} style={{ flex: 1 }} />
                <PrimaryButton title="追加" onPress={save} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <GhostButton
              title="＋ アファメーションを追加"
              onPress={() => {
                setDraftTitle('');
                setDraftBody('');
                setEditingId('new');
              }}
              style={{ marginTop: 4 }}
            />
          )}
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
    ...enLabel,
    fontSize: 20,
    color: colors.ink,
    marginTop: 12,
    marginBottom: 12,
  },
  reciteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: colors.blueDeep,
    marginBottom: 14,
  },
  playTri: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.white,
  },
  reciteText: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  cardRead: {
    borderColor: colors.blue,
    borderWidth: 1,
  },
  affTitle: {
    fontFamily: fonts.jpBold,
    fontSize: 13,
    color: colors.blueDeep,
    marginBottom: 6,
  },
  affBody: {
    fontFamily: fonts.jpBlack,
    fontSize: 14,
    lineHeight: 26,
    color: colors.ink,
  },
  readBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  readBtnOn: {
    backgroundColor: colors.bluePale,
    borderColor: colors.blue,
  },
  readBtnText: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  readBtnTextOn: {
    color: colors.blueDeep,
  },
  editBox: {
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
});
