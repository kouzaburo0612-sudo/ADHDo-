/** 設定: 目標値・スコア重み・HealthKit権限・APIキー */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, SectionTitle } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { useHealthAuth } from '@/hooks/useHealthData';
import { lastSyncDate, syncHealthData } from '@/lib/sync';
import {
  DEFAULT_SETTINGS, getApiKey, loadSettings, saveSettings, setApiKey, type Settings,
} from '@/lib/settings';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { status, request } = useHealthAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySet, setKeySet] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
    getApiKey().then((k) => setKeySet(k != null));
    lastSyncDate().then(setLastSync);
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).catch(() => {});
      return next;
    });
  }, []);

  const updateWeight = (key: keyof Settings['weights'], delta: number) => {
    const w = { ...settings.weights };
    w[key] = Math.max(0, Math.min(1, Math.round((w[key] + delta) * 20) / 20));
    update({ weights: w });
  };

  const onSaveKey = async () => {
    await setApiKey(apiKeyInput);
    setKeySet(apiKeyInput.trim() !== '');
    setApiKeyInput('');
    Alert.alert('保存しました', apiKeyInput.trim() === '' ? 'APIキーを削除しました。' : 'APIキーを安全な領域に保存しました。');
  };

  const onResync = async () => {
    setSyncing(true);
    try {
      await syncHealthData(true);
      setLastSync(await lastSyncDate());
      Alert.alert('同期完了', '過去400日分のHealthKitデータを取り直しました。');
    } catch {
      Alert.alert('同期に失敗しました', 'HealthKitの権限を確認してください。');
    } finally {
      setSyncing(false);
    }
  };

  const weightTotal = Object.values(settings.weights).reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: 120, paddingHorizontal: Spacing.md }}
    >
      <Text style={styles.title}>設定</Text>

      <SectionTitle>目標値</SectionTitle>
      <Card>
        <GoalInput
          label="体脂肪率" unit="%"
          value={settings.bodyFatGoal}
          onChange={(v) => update({ bodyFatGoal: v ?? DEFAULT_SETTINGS.bodyFatGoal })}
        />
        <GoalInput
          label="体重(任意)" unit="kg"
          value={settings.weightGoal}
          allowEmpty
          onChange={(v) => update({ weightGoal: v })}
        />
        <GoalInput
          label="睡眠時間" unit="時間"
          value={settings.sleepGoalMin / 60}
          onChange={(v) => update({ sleepGoalMin: Math.round((v ?? 7.5) * 60) })}
        />
        <GoalInput
          label="歩数" unit="歩"
          value={settings.stepsGoal}
          integer
          onChange={(v) => update({ stepsGoal: Math.round(v ?? 8000) })}
        />
      </Card>

      <SectionTitle>総合スコアの重み</SectionTitle>
      <Card>
        {([
          ['sleep', '睡眠'],
          ['recovery', '回復'],
          ['body', '体組成'],
          ['activity', '活動量'],
        ] as const).map(([key, label]) => (
          <View key={key} style={styles.weightRow}>
            <Text style={styles.rowLabel}>{label}</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => updateWeight(key, -0.05)}>
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.weightValue}>{Math.round((settings.weights[key] / weightTotal) * 100)}%</Text>
              <Pressable style={styles.stepBtn} onPress={() => updateWeight(key, 0.05)}>
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Text style={styles.hint}>合計が100%になるよう自動で正規化されます</Text>
      </Card>

      <SectionTitle>HealthKit</SectionTitle>
      <Card>
        <View style={styles.weightRow}>
          <Text style={styles.rowLabel}>読み取り許可</Text>
          <Text style={styles.rowValue}>{status === 2 ? '設定済み' : '未設定あり'}</Text>
        </View>
        <Pressable style={styles.button} onPress={() => request().catch(() => {})}>
          <Text style={styles.buttonText}>権限を再確認する</Text>
        </Pressable>
        <Text style={styles.hint}>
          個別の項目の許可は iPhoneの「設定 › プライバシーとセキュリティ › ヘルスケア › Master Health」から変更できます。
        </Text>
        <Pressable onPress={() => Linking.openURL('app-settings:')}>
          <Text style={styles.link}>設定アプリを開く</Text>
        </Pressable>
        <View style={[styles.weightRow, { marginTop: Spacing.md }]}>
          <Text style={styles.rowLabel}>最終同期</Text>
          <Text style={styles.rowValue}>{lastSync ?? '未同期'}</Text>
        </View>
        <Pressable style={styles.button} onPress={onResync} disabled={syncing}>
          <Text style={styles.buttonText}>{syncing ? '同期中…' : '全データを再同期'}</Text>
        </Pressable>
      </Card>

      <SectionTitle>Anthropic APIキー</SectionTitle>
      <Card>
        <Text style={styles.hint}>
          {keySet ? 'APIキーは設定済みです。変更する場合は新しいキーを入力してください。' : 'AIアドバイスに使うAPIキー。端末のセキュア領域にのみ保存されます。'}
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
        <Pressable style={styles.button} onPress={onSaveKey}>
          <Text style={styles.buttonText}>保存</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

function GoalInput({ label, unit, value, onChange, integer, allowEmpty }: {
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
    <View style={styles.weightRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.goalInput}
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
  screen: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: Type.title, fontWeight: '700' },
  weightRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: { color: Colors.text, fontSize: Type.body },
  rowValue: { color: Colors.textSecondary, fontSize: Type.body },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { color: Colors.text, fontSize: 17 },
  weightValue: {
    color: Colors.text, fontSize: Type.body, fontWeight: '600',
    fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'center',
  },
  hint: { color: Colors.textFaint, fontSize: Type.caption, lineHeight: 17, marginTop: 6 },
  link: { color: Colors.accent, fontSize: Type.body, marginTop: Spacing.sm },
  button: {
    backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm,
    paddingVertical: 11, alignItems: 'center', marginTop: Spacing.md,
  },
  buttonText: { color: Colors.accent, fontSize: Type.body, fontWeight: '600' },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, marginTop: Spacing.sm,
    fontSize: Type.body,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalInput: {
    color: Colors.text, fontSize: Type.body, fontWeight: '600', fontVariant: ['tabular-nums'],
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 6, minWidth: 72, textAlign: 'right',
  },
  unit: { color: Colors.textFaint, fontSize: Type.caption, minWidth: 28 },
});
