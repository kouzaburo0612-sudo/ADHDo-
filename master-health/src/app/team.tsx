/**
 * チーム: スタッフ・役員同士で健康状態を相互に見る。
 * 「太ってきた・寝れてない・ストレス高い・運動不足」がひと目でわかるカードを並べる。
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share,
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/BrandHeader';
import { Card, SectionTitle } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import {
  createTeam, fetchTeam, FLAG_LABELS, joinTeam, leaveTeam, pushSnapshot, updateShare,
  type ShareSettings, type TeamMember, type TeamState,
} from '@/lib/team';

const SHARE_ITEMS: { key: keyof ShareSettings; label: string }[] = [
  { key: 'weight', label: '体重' },
  { key: 'sleep', label: '睡眠' },
  { key: 'stress', label: 'ストレス' },
  { key: 'activity', label: '活動' },
  { key: 'balance', label: 'カロリー収支' },
];

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<TeamState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // フォーム
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [myName, setMyName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await pushSnapshot(); // 自分の最新状態を上げてから読む
      setState(await fetchTeam());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!myName.trim()) { Alert.alert('あなたの表示名を入れてください'); return; }
    setBusy(true);
    try {
      if (mode === 'create') {
        if (!teamName.trim()) { Alert.alert('チーム名を入れてください'); return; }
        const invite = await createTeam(teamName.trim(), myName.trim(), '💪');
        Alert.alert('チームを作成しました', `招待コード: ${invite}\nメンバーに共有してください`);
      } else {
        if (!code.trim()) { Alert.alert('招待コードを入れてください'); return; }
        await joinTeam(code.trim(), myName.trim(), '💪');
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error && e.message === 'INVALID_CODE'
        ? '招待コードが見つかりません'
        : 'ネットワークを確認してもう一度お試しください';
      Alert.alert('うまくいきませんでした', msg);
    } finally {
      setBusy(false);
    }
  };

  const toggleShare = async (key: keyof ShareSettings, value: boolean) => {
    if (!state?.share) return;
    const next = { ...state.share, [key]: value };
    setState({ ...state, share: next });
    try {
      await updateShare(next);
      await pushSnapshot();
    } catch { /* 次回フォーカス時に再同期 */ }
  };

  const confirmLeave = () => {
    Alert.alert('チームを退出', '共有が停止され、あなたのデータはチームから見えなくなります。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '退出する', style: 'destructive',
        onPress: async () => { await leaveTeam().catch(() => {}); load(); },
      },
    ]);
  };

  const shareInvite = () => {
    if (!state?.inviteCode) return;
    Share.share({
      message: `VYTAのチーム「${state.teamName}」に参加してください。アプリのチームタブで招待コード「${state.inviteCode}」を入力!`,
    }).catch(() => {});
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, padding: Spacing.md, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
    >
      <BrandHeader sub="チーム" />

      {state == null && (
        <View style={{ marginTop: Spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      )}

      {error != null && state != null && (
        <Card style={{ marginTop: Spacing.md, borderColor: Colors.warn, borderWidth: 1 }}>
          <Text style={styles.muted}>接続できませんでした。下に引っ張って再読み込みしてください。</Text>
        </Card>
      )}

      {/* 未参加: 参加 or 作成 */}
      {state != null && !state.joined && (
        <>
          <Card style={{ marginTop: Spacing.md }}>
            <Text style={styles.introTitle}>チームで健康を見守り合う</Text>
            <Text style={styles.introBody}>
              スタッフや役員同士で、体重の増減・睡眠不足・ストレス・運動不足がひと目でわかります。
              共有する項目は自分で選べます。
            </Text>
          </Card>

          <View style={styles.modeTabs}>
            <Pressable style={[styles.modeTab, mode === 'join' && styles.modeTabActive]} onPress={() => setMode('join')}>
              <Text style={[styles.modeTabText, mode === 'join' && styles.modeTabTextActive]}>コードで参加</Text>
            </Pressable>
            <Pressable style={[styles.modeTab, mode === 'create' && styles.modeTabActive]} onPress={() => setMode('create')}>
              <Text style={[styles.modeTabText, mode === 'create' && styles.modeTabTextActive]}>チームを作る</Text>
            </Pressable>
          </View>

          <Card>
            {mode === 'join' ? (
              <TextInput
                style={styles.input}
                value={code} onChangeText={setCode}
                placeholder="招待コード(例: A1B2C3)"
                placeholderTextColor={Colors.textFaint}
                autoCapitalize="characters"
              />
            ) : (
              <TextInput
                style={styles.input}
                value={teamName} onChangeText={setTeamName}
                placeholder="チーム名(例: 経営チーム)"
                placeholderTextColor={Colors.textFaint}
              />
            )}
            <TextInput
              style={[styles.input, { marginTop: Spacing.sm }]}
              value={myName} onChangeText={setMyName}
              placeholder="あなたの表示名(例: コウザブロウ)"
              placeholderTextColor={Colors.textFaint}
            />
            <Pressable style={[styles.btn, busy && { opacity: 0.5 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color={Colors.bg} /> : (
                <Text style={styles.btnText}>{mode === 'join' ? '参加する' : '作成する'}</Text>
              )}
            </Pressable>
          </Card>
        </>
      )}

      {/* 参加済み: メンバー一覧 */}
      {state?.joined && (
        <>
          <Card style={{ marginTop: Spacing.md }}>
            <View style={styles.teamHead}>
              <View>
                <Text style={styles.teamName}>{state.teamName}</Text>
                <Text style={styles.muted}>招待コード: {state.inviteCode}</Text>
              </View>
              <Pressable style={styles.inviteBtn} onPress={shareInvite}>
                <Text style={styles.inviteBtnText}>招待を送る</Text>
              </Pressable>
            </View>
          </Card>

          <SectionTitle>メンバー</SectionTitle>
          {(state.members ?? []).map((m) => <MemberCard key={m.id} m={m} />)}

          <SectionTitle>共有する項目(自分)</SectionTitle>
          <Card>
            {SHARE_ITEMS.map((item, i) => (
              <View key={item.key} style={[styles.shareRow, i > 0 && styles.shareRowBorder]}>
                <Text style={styles.shareLabel}>{item.label}</Text>
                <Switch
                  value={state.share?.[item.key] ?? true}
                  onValueChange={(v) => toggleShare(item.key, v)}
                  trackColor={{ true: Colors.accentDim }}
                  thumbColor={state.share?.[item.key] ? Colors.accent : undefined}
                />
              </View>
            ))}
            <Text style={styles.hint}>OFFにした項目はアップロードされません</Text>
          </Card>

          <Pressable onPress={confirmLeave} style={{ marginTop: Spacing.lg }}>
            <Text style={styles.leave}>チームを退出する</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function MemberCard({ m }: { m: TeamMember }) {
  const p = m.payload;
  const flags = p?.flags ?? [];
  const healthy = p != null && flags.length === 0;
  return (
    <Card style={[styles.memberCard, flags.length > 0 && { borderColor: Colors.warn, borderWidth: 1 }]}>
      <View style={styles.memberHead}>
        <Text style={styles.memberEmoji}>{m.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>
            {m.displayName}{m.isMe ? <Text style={styles.me}>(自分)</Text> : null}
          </Text>
          <Text style={styles.memberUpdated}>
            {m.updatedAt ? `更新 ${fmtAgo(m.updatedAt)}` : 'まだデータがありません'}
          </Text>
        </View>
        {healthy && <Text style={styles.okBadge}>✅ 好調</Text>}
      </View>

      {flags.length > 0 && (
        <View style={styles.flagRow}>
          {flags.map((f) => (
            <View key={f} style={styles.flagChip}>
              <Text style={styles.flagText}>{FLAG_LABELS[f] ?? f}</Text>
            </View>
          ))}
        </View>
      )}

      {p != null && (
        <View style={styles.statGrid}>
          {p.weightKg != null && (
            <MiniStat
              label="体重"
              value={`${p.weightKg}kg`}
              sub={p.weightDelta7d != null ? `${p.weightDelta7d >= 0 ? '+' : ''}${p.weightDelta7d}kg/7日` : undefined}
              warn={p.weightDelta7d != null && p.weightDelta7d >= 0.5}
            />
          )}
          {p.sleepAvg7Min != null && (
            <MiniStat
              label="睡眠(7日平均)"
              value={fmtMin(p.sleepAvg7Min)}
              warn={p.sleepAvg7Min < 360}
            />
          )}
          {p.stressLevel != null && (
            <MiniStat
              label="ストレス"
              value={['', '😌 快調', '🙂 ふつう', '😥 やや疲れ', '😰 つらい', '🤯 限界'][p.stressLevel] ?? String(p.stressLevel)}
              warn={p.stressLevel >= 4}
            />
          )}
          {p.stepsAvg7 != null && (
            <MiniStat
              label="歩数(7日平均)"
              value={`${p.stepsAvg7.toLocaleString()}歩`}
              warn={p.stepsAvg7 < 5000}
            />
          )}
          {p.deficit7d != null && (
            <MiniStat
              label="7日間の脂肪燃焼"
              value={`${p.deficit7d >= 0 ? '' : '−'}${Math.abs(p.deficit7d).toLocaleString()}kcal`}
              warn={p.deficit7d < 0}
            />
          )}
        </View>
      )}
    </Card>
  );
}

function MiniStat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniValue, warn && { color: Colors.warn }]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}{sub ? ` ${sub}` : ''}</Text>
    </View>
  );
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  return `${h}h${String(Math.round(min % 60)).padStart(2, '0')}m`;
}

function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'さっき';
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: Type.title, fontFamily: Fonts.sans, fontWeight: '700' },
  muted: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 2 },
  introTitle: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  introBody: { color: Colors.textSecondary, fontSize: Type.body, lineHeight: 21, marginTop: 6 },
  modeTabs: {
    flexDirection: 'row', gap: Spacing.sm,
    marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  modeTab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: Radius.sm, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  modeTabActive: { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  modeTabText: { color: Colors.textSecondary, fontSize: Type.body, fontWeight: '600' },
  modeTabTextActive: { color: Colors.text },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 12, fontSize: Type.body,
  },
  btn: {
    marginTop: Spacing.md, backgroundColor: Colors.accent, borderRadius: Radius.sm,
    paddingVertical: 13, alignItems: 'center',
  },
  btnText: { color: Colors.bg, fontWeight: '700', fontSize: Type.body },
  teamHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamName: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  inviteBtn: {
    backgroundColor: Colors.accentDim, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  inviteBtnText: { color: Colors.accent, fontSize: Type.label, fontWeight: '700' },
  memberCard: { marginBottom: Spacing.sm },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memberEmoji: { fontSize: 28 },
  memberName: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  me: { color: Colors.textFaint, fontWeight: '400', fontSize: Type.caption },
  memberUpdated: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 1 },
  okBadge: { color: Colors.good, fontSize: Type.label, fontWeight: '700' },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm },
  flagChip: {
    backgroundColor: '#3A2E1E', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  flagText: { color: Colors.warn, fontSize: Type.label, fontWeight: '600' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.sm },
  miniStat: { width: '50%', paddingVertical: 6 },
  miniValue: { color: Colors.text, fontSize: Type.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  miniLabel: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 1 },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  shareRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  shareLabel: { color: Colors.text, fontSize: Type.body },
  hint: { color: Colors.textFaint, fontSize: Type.caption, marginTop: Spacing.sm },
  leave: { color: Colors.bad, fontSize: Type.body, textAlign: 'center', fontWeight: '600' },
});
