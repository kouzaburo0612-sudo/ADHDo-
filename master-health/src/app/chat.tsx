/** ホーム = AIチャット。上部に当日サマリーカード (instructions v2 §1) */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/BrandHeader';
import { Card } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { adviceErrorMessage } from '@/lib/ai';
import { maybeAutoPost } from '@/lib/autopost';
import { maybeCompactHistory, resumeChat, sendChat, stripMarkdown, type ChatImage, type PendingAction } from '@/lib/chat';
import { appendChat, listChat } from '@/lib/store';
import { syncHealthData } from '@/lib/sync';
import { balanceSeries } from '@/utils/deficit';

interface Bubble { key: string; role: 'user' | 'assistant'; content: string; imageUri?: string }

/** APIの画像制限(1枚5MB)対策: 長辺1568pxへ縮小しJPEG品質0.7で再圧縮してbase64化 */
async function prepareImage(uri: string, width: number, height: number): Promise<ChatImage & { previewUri: string }> {
  const MAX_EDGE = 1568;
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) {
    if (width >= height) ctx.resize({ width: MAX_EDGE });
    else ctx.resize({ height: MAX_EDGE });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('IMAGE_ENCODE');
  return { base64: out.base64, mediaType: 'image/jpeg', previewUri: out.uri };
}

const SUGGESTIONS = ['今日あと何kcal食べられる?', '昼はいつもの', '今日の体重は?', '目標いつ達成できそう?'];

/**
 * 入力欄の上に常時表示するワンタップ操作。
 * 注意: 横スクロールのScrollViewに入れるとiOS(Fabric)でラベルが描画されない
 * 事象が2ビルド連続で再現したため、送信ボタンと同じ「素のView + Pressable + Text」
 * 構成の固定2段グリッドにしている。構造を変えるときは実機で必ず表示確認すること。
 */
const QUICK_ACTIONS = [
  { emoji: '🍚', label: '食事を記録', text: '食事を記録したい' },
  { emoji: '💪', label: 'トレを記録', text: 'トレーニングを記録したい' },
  { emoji: '🧠', label: 'ストレス報告', text: '今日のストレスを報告したい' },
  { emoji: '🔥', label: 'あと何kcal?', text: '今日あと何kcal食べられる?' },
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
      const [bal] = (await balanceSeries(1)).slice(-1);
      if (bal) {
        setSummary({
          kcal: bal.intake ?? 0,
          remaining: bal.burn != null ? bal.burn - (bal.intake ?? 0) : null,
        });
      }
    } catch { /* サマリーは補助情報なので失敗しても無視 */ }
  }, []);

  const push = useCallback((role: 'user' | 'assistant', content: string, imageUri?: string) => {
    setBubbles((prev) => [...prev, { key: `${Date.now()}-${prev.length}`, role, content, imageUri }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const handleResult = useCallback(async (r: { text: string; pending: PendingAction | null }) => {
    if (r.text) {
      push('assistant', r.text);
      await appendChat('assistant', r.text);
    }
    setPending(r.pending);
    refreshSummary();
    // 履歴が溜まっていたら裏で要約圧縮(失敗しても次ターンで再試行)
    maybeCompactHistory().catch(() => {});
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

  /** 写真を選んで(または撮って)そのまま送信。食事写真→AIがlog_mealで記録する流れ */
  const sendPhoto = useCallback(async (fromCamera: boolean) => {
    if (busy) return;
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('カメラの許可が必要です', '設定アプリ > VYTA からカメラを許可してください'); return; }
      }
      const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await fn({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];

      const text = input.trim();
      setInput('');
      setBusy(true);
      let img: ChatImage & { previewUri: string };
      try {
        img = await prepareImage(asset.uri, asset.width ?? 0, asset.height ?? 0);
      } catch {
        push('assistant', '画像を送信できませんでした(画像の圧縮に失敗)。別の写真でお試しください。');
        setBusy(false);
        return;
      }
      const label = text ? `📷 写真を送信: ${text}` : '📷 食事の写真を送信';
      push('user', label, img.previewUri);
      await appendChat('user', label); // 履歴にはテキストだけ残す(画像は当該ターンのみAPIへ)
      try {
        const history = bubbles.map((b) => ({ role: b.role, content: b.content }));
        const r = await sendChat(text, history, { base64: img.base64, mediaType: img.mediaType });
        await handleResult(r);
      } catch (e) {
        push('assistant', `画像を送信できませんでした(${adviceErrorMessage(e)})`);
      } finally {
        setBusy(false);
      }
    } catch {
      push('assistant', '画像を送信できませんでした(写真へのアクセスに失敗)。');
      setBusy(false);
    }
  }, [busy, input, bubbles, push, handleResult]);

  const attachPhoto = useCallback(() => {
    if (busy) return;
    Alert.alert('食事の写真を送る', 'AIが内容を認識してカロリーを概算し、確認後に記録します', [
      { text: '📷 撮影する', onPress: () => sendPhoto(true) },
      { text: '🖼 ライブラリから選ぶ', onPress: () => sendPhoto(false) },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  }, [busy, sendPhoto]);

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
        <BrandHeader
          sub={summary
            ? `Mr. Vyta ・ 今日 ${summary.kcal}kcal${summary.remaining != null ? ` / あと ${summary.remaining.toLocaleString()}kcal` : ''}`
            : 'Health Manager AI ・ Mr. Vyta'}
        />
      </View>

      <FlatList
        ref={listRef}
        data={bubbles}
        keyExtractor={(b) => b.key}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Mr. Vytaに話しかけるだけで記録・設定変更できます</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.suggestion} onPress={() => send(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
            {item.imageUri != null && (
              <Image source={{ uri: item.imageUri }} style={styles.bubbleImage} resizeMode="cover" />
            )}
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

      <View style={styles.quickBar}>
        {QUICK_ACTIONS.map((q) => (
          <Pressable
            key={q.label}
            style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.6 }]}
            onPress={() => send(q.text)}
            disabled={busy}
          >
            <Text style={styles.quickText} allowFontScaling={false} numberOfLines={1}>
              {q.emoji} {q.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        <Pressable
          style={[styles.photoBtn, busy && { opacity: 0.4 }]}
          onPress={attachPhoto}
          disabled={busy}
          hitSlop={6}
        >
          <Text style={styles.photoBtnText}>📷</Text>
        </Pressable>
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
  bubbleImage: { width: 200, height: 150, borderRadius: Radius.sm, marginBottom: 6 },
  photoBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  photoBtnText: { fontSize: 18 },
  confirmCard: { marginTop: Spacing.sm, borderColor: Colors.accent, borderWidth: 1 },
  confirmTitle: { color: Colors.textSecondary, fontSize: Type.caption, marginBottom: 6 },
  confirmBody: { color: Colors.text, fontSize: Type.body, lineHeight: 21 },
  confirmRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  confirmBtn: { flex: 1, borderRadius: Radius.sm, paddingVertical: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: Colors.surfaceRaised },
  okBtn: { backgroundColor: Colors.accent },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  okText: { color: Colors.bg, fontWeight: '700' },
  quickBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  quickBtn: {
    flexBasis: '31.5%', flexGrow: 1,
    minHeight: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.accentDim,
    paddingHorizontal: 6, paddingVertical: 8,
  },
  quickText: { color: '#F0F5F1', fontSize: 12, fontWeight: '600' },
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
