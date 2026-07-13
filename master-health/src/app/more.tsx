/**
 * More: プロフィール+全設定へのハブ。
 * v3.9でiOS自動生成のMoreリスト(素のUITableView)をやめ、
 * My Bodyと同じカードベースのダークUIで再設計した。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { GoalEditModal } from '@/components/GoalEditModal';
import { SettingsSheet } from '@/components/SettingsSheet';
import { TeamBody } from '@/components/TeamBody';
import { Card, SectionTitle } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useHealthAuth } from '@/hooks/useHealthData';
import { getRange, kvSet } from '@/lib/db';
import { addDays, formatKeyJa, toKey } from '@/lib/dates';
import { rescheduleReminders } from '@/lib/notifications';
import {
  deleteTemplate, deleteWorkoutTemplate, getProfile, listMealLogs, listStressLogs,
  listTemplates, listWorkoutLogs, listWorkoutTemplates, saveGoalPlan, saveProfile,
  type DietaryFlag, type FoodTemplate, type UserProfile, type WorkoutTemplate,
} from '@/lib/store';
import { syncHealthData } from '@/lib/sync';
import { goalNumbers, type GoalNumbers } from '@/utils/deficit';

export default function MoreScreen() {
  const { status } = useHealthAuth();
  const [goal, setGoal] = useState<GoalNumbers | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [foodTpls, setFoodTpls] = useState<FoodTemplate[]>([]);
  const [workoutTpls, setWorkoutTpls] = useState<WorkoutTemplate[]>([]);
  const [metricKinds, setMetricKinds] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [suppsOpen, setSuppsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await getProfile());
      setFoodTpls(await listTemplates());
      setWorkoutTpls(await listWorkoutTemplates());
      setGoal(await goalNumbers());
      // 直近7日で1回でも値が入った計測データの種類数(HealthKit接続の実感値)
      const today = new Date();
      const range = await getRange(toKey(addDays(today, -7)), toKey(today));
      const kinds = new Set<string>();
      for (const [, day] of range) Object.keys(day).forEach((k) => kinds.add(k));
      setMetricKinds(kinds.size);
    } catch { /* 表示は次のフォーカスで再試行 */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveGoal = async (plan: Parameters<typeof saveGoalPlan>[0]) => {
    await saveGoalPlan(plan);
    setGoalOpen(false);
    load();
  };

  const onResync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncHealthData(true);
      Alert.alert('同期完了', '過去400日分のヘルスケアデータを取り直しました。');
      load();
    } catch {
      Alert.alert('同期に失敗しました', 'ヘルスケアの権限を確認してください。');
    } finally {
      setSyncing(false);
    }
  };

  const onExport = async () => {
    try {
      const from = new Date(0).toISOString();
      const to = new Date(Date.now() + 86400000).toISOString();
      const data = {
        exportedAt: new Date().toISOString(),
        profile: await getProfile(),
        goalPlan: goal?.plan ?? null,
        meals: await listMealLogs(from, to),
        workouts: await listWorkoutLogs(from, to),
        stress: await listStressLogs(from, to),
      };
      await Share.share({ message: JSON.stringify(data, null, 1) });
    } catch {
      Alert.alert('エクスポートに失敗しました');
    }
  };

  const onNotifications = () => {
    Alert.alert(
      '通知',
      '毎朝8:00に今日のプラン、14:00にその時点で食事記録がない場合のリマインダーが届きます。',
      [
        { text: '通知を予約し直す', onPress: () => { rescheduleReminders().catch(() => {}); } },
        { text: '閉じる', style: 'cancel' },
      ],
    );
  };

  const bfNow = goal?.currentBodyFatPct;
  const goalPreview = goal?.plan.targetBodyFatPct != null
    ? `${bfNow != null ? `${bfNow.toFixed(1)}%` : '–'} → ${goal.plan.targetBodyFatPct}%${goal.plan.targetDate ? ` ・ ${formatKeyJa(goal.plan.targetDate)}` : ''}`
    : goal?.plan.targetWeightKg != null
      ? `${goal.currentWeightKg ?? '–'}kg → ${goal.plan.targetWeightKg}kg`
      : '未設定';

  return (
    <View style={styles.root}>
      <AppHeader sub="More" />
      <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 120 }}>
        {/* プロフィールカード */}
        <Pressable onPress={() => setSettingsOpen(true)}>
          <Card style={styles.profileCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>V</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>あなた</Text>
              <Text style={styles.profileGoal}>🎯 {goalPreview}</Text>
              <Text style={styles.profileSub}>
                {goal?.currentWeightKg != null ? `体重 ${goal.currentWeightKg.toFixed(1)}kg` : '体重 –'}
                {bfNow != null ? ` ・ 体脂肪率 ${bfNow.toFixed(1)}%` : ''}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Card>
        </Pressable>

        <SectionTitle>設定</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="👤" title="プロファイル"
            value={profile?.heightCm != null ? `${profile.heightCm}cm ・ ${profile.sex === 'male' ? '男性' : '女性'}` : '未設定'}
            onPress={() => setSettingsOpen(true)} />
          <Row icon="🎯" title="目標設定" value={goalPreview} onPress={() => setGoalOpen(true)} border />
          <Row icon="📋" title="テンプレート管理"
            value={`食事${foodTpls.length} ・ 運動${workoutTpls.length}`}
            onPress={() => setTplOpen(true)} border />
          <Row icon="🚫" title="食事アラート(回避食材)"
            value={profile != null && profile.dietaryFlags.length > 0 ? `${profile.dietaryFlags.length}件` : 'なし'}
            onPress={() => setFlagsOpen(true)} border />
          <Row icon="💊" title="サプリメント"
            value={profile != null && profile.supplements.length > 0 ? `${profile.supplements.length}件` : 'なし'}
            onPress={() => setSuppsOpen(true)} border />
          <Row icon="❤️" title="ヘルスケア連携"
            value={status === 2 ? `接続済み ・ データ${metricKinds}種` : '未設定あり'}
            badge={status === 2 ? 'ok' : 'warn'}
            onPress={() => setSettingsOpen(true)} border />
          <Row icon="🔔" title="通知" value="朝8:00 ・ 14:00" onPress={onNotifications} border />
        </Card>

        <SectionTitle>チーム</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="👥" title="チームで見守り合う" value="メンバーの健康状態を確認"
            onPress={() => setTeamOpen(true)} />
        </Card>

        <SectionTitle>データ</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="📤" title="エクスポート" value="記録をJSONで共有" onPress={onExport} />
          <Row icon="📥" title="インポート" value="準備中" disabled border onPress={() => {}} />
          <Row icon="🔄" title="ヘルスケア全データ再同期"
            value={syncing ? '同期中…' : '過去400日分'}
            onPress={onResync} border />
        </Card>

        <SectionTitle>その他</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="⚙️" title="すべての設定(APIキーなど)" value="" onPress={() => setSettingsOpen(true)} />
          <Row icon="📖" title="チュートリアルをもう一度見る" value="" border
            onPress={async () => {
              await kvSet('onboarded_v1', '');
              Alert.alert('OK', 'アプリを一度閉じて開き直すとチュートリアルが表示されます。');
            }} />
        </Card>
      </ScrollView>

      <SettingsSheet visible={settingsOpen} onClose={() => { setSettingsOpen(false); load(); }} />
      <GoalEditModal visible={goalOpen} goal={goal} onClose={() => setGoalOpen(false)} onSave={saveGoal} />

      {/* チーム(モーダル) */}
      <Modal visible={teamOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTeamOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>チーム</Text>
            <Pressable onPress={() => setTeamOpen(false)} hitSlop={12}><Text style={styles.modalDone}>完了</Text></Pressable>
          </View>
          <TeamBody />
        </View>
      </Modal>

      <TemplateModal
        visible={tplOpen} onClose={() => { setTplOpen(false); load(); }}
        foods={foodTpls} workouts={workoutTpls}
      />
      {profile != null && (
        <>
          <FlagsModal
            visible={flagsOpen} profile={profile}
            onClose={() => { setFlagsOpen(false); load(); }}
          />
          <SuppsModal
            visible={suppsOpen} profile={profile}
            onClose={() => { setSuppsOpen(false); load(); }}
          />
        </>
      )}
    </View>
  );
}

function Row({ icon, title, value, onPress, border, disabled, badge }: {
  icon: string; title: string; value: string;
  onPress: () => void; border?: boolean; disabled?: boolean; badge?: 'ok' | 'warn';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, border && styles.rowBorder, (pressed || disabled) && { opacity: 0.5 }]}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
      {badge != null && (
        <View style={[styles.badge, { backgroundColor: badge === 'ok' ? Colors.accentDim : '#3A2E1E' }]}>
          <Text style={[styles.badgeText, { color: badge === 'ok' ? Colors.accent : Colors.warn }]}>
            {badge === 'ok' ? '接続済み' : '要確認'}
          </Text>
        </View>
      )}
      {value !== '' && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

/** テンプレート管理(一覧+削除)。登録は実績報告タブ or Mr. Vytaから */
function TemplateModal({ visible, onClose, foods, workouts }: {
  visible: boolean; onClose: () => void;
  foods: FoodTemplate[]; workouts: WorkoutTemplate[];
}) {
  const [foodList, setFoodList] = useState(foods);
  const [workoutList, setWorkoutList] = useState(workouts);
  useEffect(() => {
    if (visible) { setFoodList(foods); setWorkoutList(workouts); }
  }, [visible, foods, workouts]);

  const refresh = async () => {
    setFoodList(await listTemplates());
    setWorkoutList(await listWorkoutTemplates());
  };
  const removeFood = (t: FoodTemplate) => {
    Alert.alert('テンプレートを削除', `「${t.name}」を削除しますか?`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => { await deleteTemplate(t.id); refresh(); } },
    ]);
  };
  const removeWorkout = (t: WorkoutTemplate) => {
    Alert.alert('テンプレートを削除', `「${t.name}」を削除しますか?`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => { await deleteWorkoutTemplate(t.id); refresh(); } },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>テンプレート管理</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.modalDone}>完了</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}>
          <Text style={styles.hint}>新規登録は実績報告タブの「テンプレに保存」か、Mr. Vytaに話しかけてください</Text>
          <SectionTitle>{`食事テンプレート(${foodList.length}/30)`}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {foodList.length === 0 ? <Text style={styles.hint}>まだありません</Text> : foodList.map((t, i) => (
              <View key={t.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Text style={styles.rowTitle}>{t.name}</Text>
                {t.aliases.length > 0 && <Text style={styles.rowValue}>別名: {t.aliases.join('、')}</Text>}
                <Pressable onPress={() => removeFood(t)} hitSlop={8}><Text style={styles.deleteText}>削除</Text></Pressable>
              </View>
            ))}
          </Card>
          <SectionTitle>{`運動テンプレート(${workoutList.length}/30)`}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {workoutList.length === 0 ? <Text style={styles.hint}>まだありません</Text> : workoutList.map((t, i) => (
              <View key={t.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Text style={styles.rowTitle}>{t.name}</Text>
                <Text style={styles.rowValue}>{t.exercises.length}種目</Text>
                <Pressable onPress={() => removeWorkout(t)} hitSlop={8}><Text style={styles.deleteText}>削除</Text></Pressable>
              </View>
            ))}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** 回避食材(DietaryFlag)の管理 */
function FlagsModal({ visible, profile, onClose }: {
  visible: boolean; profile: UserProfile; onClose: () => void;
}) {
  const [flags, setFlags] = useState<DietaryFlag[]>(profile.dietaryFlags);
  const [input, setInput] = useState('');
  useEffect(() => { if (visible) setFlags(profile.dietaryFlags); }, [visible, profile.dietaryFlags]);

  const persist = async (next: DietaryFlag[]) => {
    setFlags(next);
    await saveProfile({ ...(await getProfile()), dietaryFlags: next });
  };
  const add = () => {
    const name = input.trim();
    if (!name) return;
    setInput('');
    persist([...flags, { ingredient: name, severity: 'avoid' }]).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>食事アラート(回避食材)</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.modalDone}>完了</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>登録した食材が食事に含まれると、Mr. Vytaが必ず指摘します</Text>
          <Card>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput
                style={styles.input}
                value={input} onChangeText={setInput}
                placeholder="例: 小麦 / 乳製品 / アルコール"
                placeholderTextColor={Colors.textFaint}
              />
              <Pressable style={styles.addBtn} onPress={add}><Text style={styles.addBtnText}>追加</Text></Pressable>
            </View>
          </Card>
          <Card style={{ marginTop: Spacing.sm, paddingVertical: 4 }}>
            {flags.length === 0 ? <Text style={styles.hint}>まだありません</Text> : flags.map((f2, i) => (
              <View key={`${f2.ingredient}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Text style={styles.rowTitle}>{f2.ingredient}</Text>
                <Pressable onPress={() => persist(flags.filter((_, j) => j !== i)).catch(() => {})} hitSlop={8}>
                  <Text style={styles.deleteText}>削除</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** サプリメントの管理 */
function SuppsModal({ visible, profile, onClose }: {
  visible: boolean; profile: UserProfile; onClose: () => void;
}) {
  const [supps, setSupps] = useState(profile.supplements);
  const [input, setInput] = useState('');
  useEffect(() => { if (visible) setSupps(profile.supplements); }, [visible, profile.supplements]);

  const persist = async (next: typeof supps) => {
    setSupps(next);
    await saveProfile({ ...(await getProfile()), supplements: next });
  };
  const add = () => {
    const name = input.trim();
    if (!name) return;
    setInput('');
    persist([...supps, { name }]).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>サプリメント</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={styles.modalDone}>完了</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>登録するとMr. Vytaが文脈に応じて飲み忘れ等に触れられるようになります</Text>
          <Card>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput
                style={styles.input}
                value={input} onChangeText={setInput}
                placeholder="例: マルチビタミン / オメガ3"
                placeholderTextColor={Colors.textFaint}
              />
              <Pressable style={styles.addBtn} onPress={add}><Text style={styles.addBtnText}>追加</Text></Pressable>
            </View>
          </Card>
          <Card style={{ marginTop: Spacing.sm, paddingVertical: 4 }}>
            {supps.length === 0 ? <Text style={styles.hint}>まだありません</Text> : supps.map((s, i) => (
              <View key={`${s.name}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Text style={styles.rowTitle}>{s.name}</Text>
                <Pressable onPress={() => persist(supps.filter((_, j) => j !== i)).catch(() => {})} hitSlop={8}>
                  <Text style={styles.deleteText}>削除</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accentDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.accent,
  },
  avatarText: { color: Colors.accent, fontSize: 26, fontFamily: Fonts.brand },
  profileName: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  profileGoal: { color: Colors.accent, fontSize: Type.caption, marginTop: 3, fontWeight: '600' },
  profileSub: { color: Colors.textSecondary, fontSize: Type.caption, marginTop: 3, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowTitle: { color: Colors.text, fontSize: Type.body, fontWeight: '600', flexShrink: 1 },
  rowValue: { color: Colors.textFaint, fontSize: Type.caption, marginLeft: 'auto', maxWidth: 150, textAlign: 'right' },
  chevron: { color: Colors.textFaint, fontSize: 20, marginLeft: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto' },
  badgeText: { fontSize: Type.label, fontWeight: '700' },
  hint: { color: Colors.textFaint, fontSize: Type.caption, lineHeight: 17, marginBottom: Spacing.sm },
  deleteText: { color: Colors.bad, fontSize: Type.caption, fontWeight: '600', marginLeft: Spacing.sm },
  modalRoot: { flex: 1, backgroundColor: Colors.bg },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  modalDone: { color: Colors.accent, fontSize: Type.body, fontWeight: '700' },
  input: {
    flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: Type.body,
  },
  addBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.sm,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  addBtnText: { color: Colors.bg, fontWeight: '700' },
});
