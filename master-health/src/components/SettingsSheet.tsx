/**
 * 設定シート(My Bodyの⚙から開くモーダル)
 * タブから外した理由: iOSのタブは5個までで、6個目以降は味気ない「その他」リストに
 * 押し込まれるため。設定は毎日開く画面ではないのでモーダルに退避した。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { Card, Segmented } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useHealthAuth } from '@/hooks/useHealthData';
import { kvSet } from '@/lib/db';
import { lastSyncDate, syncHealthData } from '@/lib/sync';
import {
  DEFAULT_SETTINGS, getApiKey, loadSettings, saveSettings, setApiKey, type Settings,
} from '@/lib/settings';
import { getProfile, saveProfile, DEFAULT_PROFILE, type UserProfile } from '@/lib/store';
import { balanceSeries } from '@/utils/deficit';

/** モーダル(My Bodyの⚙)とタブ内ルート(More→設定)の両方から使う本体 */
export function SettingsBody() {
  const { status, request } = useHealthAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySet, setKeySet] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [avgTdee, setAvgTdee] = useState<number | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
    getProfile().then(setProfile);
    getApiKey().then((k) => setKeySet(k != null));
    lastSyncDate().then(setLastSync);
    // 直近7日の平均TDEE(消費)
    balanceSeries(7).then((s) => {
      const burns = s.map((d) => d.burn).filter((b): b is number => b != null);
      setAvgTdee(burns.length ? Math.round(burns.reduce((a, b) => a + b, 0) / burns.length) : null);
    }).catch(() => {});
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next).catch(() => {});
      return next;
    });
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).catch(() => {});
      return next;
    });
  }, []);

  const onSaveKey = async () => {
    await setApiKey(apiKeyInput);
    setKeySet(apiKeyInput.trim() !== '');
    setApiKeyInput('');
    Alert.alert('保存しました');
  };

  const onResync = async () => {
    setSyncing(true);
    try {
      await syncHealthData(true);
      setLastSync(await lastSyncDate());
      Alert.alert('同期完了', '過去400日分のヘルスケアデータを取り直しました。');
    } catch {
      Alert.alert('同期に失敗しました', 'ヘルスケアの権限を確認してください。');
    } finally {
      setSyncing(false);
    }
  };

  const replayTutorial = async () => {
    await kvSet('onboarded_v1', '');
    Alert.alert('OK', 'アプリを一度閉じて開き直すとチュートリアルが表示されます。');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.hintTop}>
            💬 ここにある設定はぜんぶAIチャットからも変えられます(例:「身長168にして」「目標体脂肪率13%、9月末までに」)
          </Text>

          {/* 今週の平均TDEE */}
          <Card style={styles.tdeeCard}>
            <Text style={styles.sectionEmoji}>🔥</Text>
            <Text style={styles.tdeeValue}>
              {avgTdee != null ? avgTdee.toLocaleString() : '–'}
              <Text style={styles.tdeeUnit}> kcal/日</Text>
            </Text>
            <Text style={styles.tdeeLabel}>今週の平均TDEE(消費カロリー)</Text>
            <Text style={styles.tdeeHint}>これより少なく食べれば痩せ、多く食べれば太ります</Text>
          </Card>

          <SectionHead emoji="👤" title="プロファイル(TDEE計算に使用)" />
          <Card>
            <NumRow
              label="身長" unit="cm" value={profile.heightCm} allowEmpty
              onChange={(v) => updateProfile({ heightCm: v })}
            />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>生年月日</Text>
              <BirthInput value={profile.birthDate} onChange={(v) => updateProfile({ birthDate: v })} />
            </View>
            <View style={[styles.row, { alignItems: 'center' }]}>
              <Text style={styles.rowLabel}>性別</Text>
              <View style={{ width: 160 }}>
                <Segmented
                  options={[{ value: 'male', label: '男性' }, { value: 'female', label: '女性' }]}
                  value={profile.sex}
                  onChange={(v) => updateProfile({ sex: v })}
                />
              </View>
            </View>
          </Card>

          <SectionHead emoji="🎯" title="スコアの目標基準" />
          <Card>
            <NumRow
              label="体脂肪率(体組成スコア)" unit="%"
              value={settings.bodyFatGoal}
              onChange={(v) => update({ bodyFatGoal: v ?? DEFAULT_SETTINGS.bodyFatGoal })}
            />
            <NumRow
              label="睡眠時間" unit="時間"
              value={settings.sleepGoalMin / 60}
              onChange={(v) => update({ sleepGoalMin: Math.round((v ?? 7.5) * 60) })}
            />
            <NumRow
              label="歩数" unit="歩" integer
              value={settings.stepsGoal}
              onChange={(v) => update({ stepsGoal: Math.round(v ?? 8000) })}
            />
            <Text style={styles.hint}>減量の目標(目標体重・期日)はトレンドタブの「目標設定」から</Text>
          </Card>

          <SectionHead emoji="❤️" title="ヘルスケア連携" />
          <Card>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>読み取り許可</Text>
              <Text style={styles.rowValue}>{status === 2 ? '設定済み' : '未設定あり'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>最終同期</Text>
              <Text style={styles.rowValue}>{lastSync ?? '未同期'}</Text>
            </View>
            <View style={styles.btnRow}>
              <Pressable style={styles.btnGhost} onPress={() => request().catch(() => {})}>
                <Text style={styles.btnGhostText}>権限を再確認</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={onResync} disabled={syncing}>
                <Text style={styles.btnGhostText}>{syncing ? '同期中…' : '全データ再同期'}</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => Linking.openURL('app-settings:')}>
              <Text style={styles.link}>iPhoneの設定アプリで個別の許可を変更する ›</Text>
            </Pressable>
          </Card>

          <SectionHead emoji="🔑" title="AI(Anthropic APIキー)" />
          <Card>
            <Text style={styles.hint}>
              {keySet ? '設定済み。変更する場合のみ新しいキーを入力してください。' : 'AIチャットに使うAPIキー。端末のセキュア領域にのみ保存されます。'}
            </Text>
            <TextInput
              style={styles.input}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="sk-ant-…"
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Pressable style={styles.btn} onPress={onSaveKey}>
              <Text style={styles.btnText}>保存</Text>
            </Pressable>
          </Card>

      <SectionHead emoji="📖" title="その他" />
      <Card>
        <Pressable onPress={replayTutorial}>
          <Text style={styles.link}>チュートリアルをもう一度見る ›</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

/** My Bodyの⚙から開くモーダル版 */
export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.head}>
          <Text style={styles.title}>設定</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeText}>完了</Text>
          </Pressable>
        </View>
        <SettingsBody />
      </View>
    </Modal>
  );
}

function SectionHead({ emoji, title }: { emoji: string; title: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function BirthInput({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => { setText(value ?? ''); }, [value]);
  return (
    <TextInput
      style={styles.numInput}
      value={text}
      onChangeText={setText}
      onEndEditing={() => {
        const t = text.trim();
        if (t === '') { onChange(null); return; }
        if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(t).getTime())) onChange(t);
        else Alert.alert('形式エラー', '1990-01-31 のように入力してください。');
      }}
      placeholder="1990-01-31"
      placeholderTextColor={Colors.textFaint}
      autoCapitalize="none"
    />
  );
}

function NumRow({ label, unit, value, onChange, integer, allowEmpty }: {
  label: string;
  unit: string;
  value: number | null;
  onChange: (v: number | null) => void;
  integer?: boolean;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText(value == null ? '' : String(integer ? Math.round(value) : value));
  }, [value, integer]);

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.numInput}
          value={text}
          onChangeText={setText}
          onEndEditing={() => {
            const n = parseFloat(text);
            if (Number.isFinite(n)) onChange(n);
            else if (allowEmpty && text.trim() === '') onChange(null);
          }}
          keyboardType="decimal-pad"
          placeholder="–"
          placeholderTextColor={Colors.textFaint}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md + 4, paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: Type.title, fontFamily: Fonts.sans, fontWeight: '700' },
  closeBtn: { paddingHorizontal: 4 },
  closeText: { color: Colors.accent, fontSize: Type.body, fontWeight: '700' },
  hintTop: {
    color: Colors.textSecondary, fontSize: Type.caption, lineHeight: 18,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    padding: Spacing.sm + 2, marginBottom: Spacing.sm, overflow: 'hidden',
  },
  tdeeCard: { alignItems: 'center', paddingVertical: Spacing.lg, marginBottom: Spacing.sm },
  tdeeValue: {
    color: Colors.accent, fontSize: 40, fontFamily: Fonts.display, fontWeight: '700',
    fontVariant: ['tabular-nums'], marginTop: 4,
  },
  tdeeUnit: { fontSize: Type.body, color: Colors.textSecondary, fontWeight: '400' },
  tdeeLabel: { color: Colors.text, fontSize: Type.body, fontWeight: '600', marginTop: 4 },
  tdeeHint: { color: Colors.textFaint, fontSize: Type.caption, marginTop: 4 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { color: Colors.textSecondary, fontSize: Type.label, fontWeight: '700', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9,
  },
  rowLabel: { color: Colors.text, fontSize: Type.body, flexShrink: 1 },
  rowValue: { color: Colors.textSecondary, fontSize: Type.body },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numInput: {
    color: Colors.text, fontSize: Type.body, fontWeight: '600', fontVariant: ['tabular-nums'],
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 7, minWidth: 90, textAlign: 'right',
  },
  unit: { color: Colors.textFaint, fontSize: Type.caption, minWidth: 28 },
  hint: { color: Colors.textFaint, fontSize: Type.caption, lineHeight: 17, marginTop: 8 },
  link: { color: Colors.accent, fontSize: Type.body, paddingVertical: 6 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: 4 },
  btnGhost: {
    flex: 1, backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm,
    paddingVertical: 11, alignItems: 'center',
  },
  btnGhostText: { color: Colors.accent, fontSize: Type.body, fontWeight: '600' },
  btn: {
    backgroundColor: Colors.accent, borderRadius: Radius.sm,
    paddingVertical: 12, alignItems: 'center', marginTop: Spacing.md,
  },
  btnText: { color: Colors.bg, fontSize: Type.body, fontWeight: '700' },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, marginTop: Spacing.sm,
    fontSize: Type.body,
  },
});
