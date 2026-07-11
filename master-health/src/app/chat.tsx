/** ホーム = AIチャット。上部に当日サマリーカード (instructions v2 §1) */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { adviceErrorMessage } from '@/lib/ai';
import { maybeAutoPost } from '@/lib/autopost';
import { currentTdee, resumeChat, sendChat, stripMarkdown, type PendingAction } from '@/lib/chat';
import { addDays } from '@/lib/dates';
import { appendChat, dailyIntake, listChat, localDateKey } from '@/lib/store';
import { syncHealthData } from '@/lib/sync';

interface Bubble { key: string; role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = ['今日あと何kcal食べられる?', '昼はいつもの', '今日の体重は?', '目標いつ達成できそう?'];

/**
 * 入力欄の上に常時表示するワンタップ操作。
 * 絵文字は本文と別のTextノードで描画する(異体字セレクタ付き絵文字が
 * ラベル全体を不可視にするiOSのフォント解決問題を避けるため)。
 */
const QUICK_ACTIONS = [
  { emoji: '🍚', label: '食事を記録', text: '食事を記録したい' },
  { emoji: '🔥', label: 'あと何kcal?', text: '今日あと何kcal食べられる?' },
  { emoji: '💪', label: 'トレを記録', text: 'トレーニングを記録したい' },
  { emoji: '📊', label: '今日の調子', text: '今日のコンディションを教えて' },
  { emoji: '🎯', label: '目標の進捗', text: '目標達成の見込みを教えて' },
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [summary, setSummary] = useState<{ kcal: number; remaining: number | null } | null>(null);
  const listRef = useRef<FlatList<Bubble>>(null);

  useEffect(() => {
    (async () => {
      const history = await listChat();
      setBubbles(history.map((m) => ({ key: String(m.id), role: m.role, content: m.content })));
      syncHealthData().catch(() => {});
      refreshSummary();
      // 朝プラン・週次ダイジェストの自動投稿(必要なときだけ生成される)
      const auto = await maybeAutoPost();
      if (auto) {
        setBubbles((prev) => [...prev, { key: `auto-${Date.now()}`, role: 'assistant', content: auto }]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSummary = useCallback(async () => {
    try {
      const today = new Date();
      const intake = await dailyIntake(addDays(today, -8).toISOString(), today.toISOString());
      const kcal = intake.get(localDateKey(today.toISOString()))?.kcal ?? 0;
      const tdee = await currentTdee();
      const remaining = tdee.effective != null ? Math.round(tdee.effective - kcal) : null;
      setSummary({ kcal: Math.round(kcal), remaining });
    } catch { /* サマリーは補助情報なので失敗しても無視 */ }
  }, []);

  const push = useCallback((role: 'user' | 'assistant', content: string) => {
    setBubbles((prev) => [...prev, { key: `${Date.now()}-${prev.length}`, role, content }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const handleResult = useCallback(async (r: { text: string; pending: PendingAction | null }) => {
    if (r.text) {
      push('assistant', r.text);
      await appendChat('assistant', r.text);
    }
    setPending(r.pending);
    refreshSummary();
  }, [push, refreshSummary]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    push('user', msg);
    await appendChat('user', msg);
    setBusy(true);
    try {
      const history = bubbles.map((b) => ({ role: b.role, content: b.content }));
      const r = await sendChat(msg, history);
      await handleResult(r);
    } catch (e) {
      push('assistant', adviceErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [input, busy, bubbles, push, handleResult]);

  const decide = useCallback(async (approved: boolean) => {
    if (!pending || busy) return;
    setBusy(true);
    const p = pending;
    setPending(null);
    try {
      const r = await resumeChat(p, approved);
      await handleResult(r);
    } catch (e) {
      push('assistant', adviceErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [pending, busy, handleResult, push]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={styles.title}>VYTA</Text>
        {summary && (
          <Text style={styles.summaryText}>
            今日 {summary.kcal}kcal 摂取
            {summary.remaining != null ? ` ・ あと ${summary.remaining.toLocaleString()}kcal` : ''}
          </Text>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={bubbles}
        keyExtractor={(b) => b.key}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>話しかけるだけで記録できます</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.suggestion} onPress={() => send(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
            <Text selectable style={item.role === 'user' ? styles.bubbleUserText : styles.bubbleAiText}>
              {/* 過去バージョンで保存された履歴にマークダウンが残っている場合も表示時に除去 */}
              {item.role === 'assistant' ? stripMarkdown(item.content) : item.content}
            </Text>
          </View>
        )}
        ListFooterComponent={
          <>
            {pending && (
              <Card style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>この内容で記録しますか?</Text>
                <Text style={styles.confirmBody}>{pending.summary}</Text>
                <View style={styles.confirmRow}>
                  <Pressable style={[styles.confirmBtn, styles.cancelBtn]} onPress={() => decide(false)}>
                    <Text style={styles.cancelText}>キャンセル</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmBtn, styles.okBtn]} onPress={() => decide(true)}>
                    <Text style={styles.okText}>記録する</Text>
                  </Pressable>
                </View>
              </Card>
            )}
            {busy && <ActivityIndicator color={Colors.accent} style={{ marginVertical: Spacing.md }} />}
          </>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickBar}
        contentContainerStyle={styles.quickBarContent}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_ACTIONS.map((q) => (
          <Pressable key={q.label} style={styles.quickBtn} onPress={() => send(q.text)} disabled={busy}>
            <Text style={styles.quickEmoji}>{q.emoji}</Text>
            <Text style={styles.quickText} allowFontScaling={false}>{q.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="例: 昼はいつもの / ベンチ90lb 8回3セット"
          placeholderTextColor={Colors.textFaint}
          multiline
          editable={!busy}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || busy) && styles.sendBtnDisabled]}
          onPress={() => send()}
          disabled={!input.trim() || busy}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: Type.title, fontFamily: Fonts.sans, fontWeight: '700' },
  summaryText: { color: Colors.textSecondary, fontSize: Type.caption, marginTop: 2, fontVariant: ['tabular-nums'] },
  listContent: { padding: Spacing.md, gap: Spacing.sm, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xl },
  emptyTitle: { color: Colors.textSecondary, fontSize: Type.body, marginBottom: Spacing.sm },
  suggestion: {
    backgroundColor: Colors.surface, borderRadius: 999,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  suggestionText: { color: Colors.accent, fontSize: Type.body },
  bubble: { maxWidth: '85%', borderRadius: Radius.md, padding: Spacing.sm + 2 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.accentDim },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: Colors.surface },
  bubbleUserText: { color: Colors.text, fontSize: Type.body, lineHeight: 21 },
  bubbleAiText: { color: Colors.text, fontSize: Type.body, lineHeight: 21 },
  confirmCard: { marginTop: Spacing.sm, borderColor: Colors.accent, borderWidth: 1 },
  confirmTitle: { color: Colors.textSecondary, fontSize: Type.caption, marginBottom: 6 },
  confirmBody: { color: Colors.text, fontSize: Type.body, lineHeight: 21 },
  confirmRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  confirmBtn: { flex: 1, borderRadius: Radius.sm, paddingVertical: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: Colors.surfaceRaised },
  okBtn: { backgroundColor: Colors.accent },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  okText: { color: Colors.bg, fontWeight: '700' },
  quickBar: { flexGrow: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  quickBarContent: { gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceRaised, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.accentDim,
  },
  quickEmoji: { fontSize: 14 },
  quickText: { color: '#F0F5F1', fontSize: 13, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: 4,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + 4, paddingVertical: 10,
    color: Colors.text, fontSize: Type.body,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: Colors.bg, fontSize: 20, fontWeight: '700' },
});
