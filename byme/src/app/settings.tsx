import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { Card, Field, GhostButton, PrimaryButton, SectionLabel } from '../components/ui';
import { TimeStepper } from '../components/time-stepper';
import { exportAll } from '../db/queries';
import type { Affirmation } from '../db/types';
import { formatHHMM, parseHHMM } from '../lib/dates';
import { ensurePermission } from '../lib/notifications';
import { canAddAffirmation } from '../lib/progate';
import { useAppStore } from '../store/useAppStore';
import { colors, fonts, spacing } from '../theme/tokens';

export default function Settings() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SectionLabel en="SETTINGS" jp="設定" />
          <NotificationSection />
          <AffirmationSection />
          <ExportSection />
          <AboutSection />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- 通知 ----------

function NotificationSection() {
  const settings = useAppStore((s) => s.settings);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);

  const parsed = parseHHMM(settings.notify_morning ?? '') ?? { hour: 6, minute: 30 };
  const eveningEnabled = (settings.notify_evening_enabled ?? '1') === '1';

  return (
    <Card style={{ gap: 14, marginBottom: 14 }}>
      <SectionLabel en="MORNING" jp="朝の宣言通知" />
      <TimeStepper
        hour={parsed.hour}
        minute={parsed.minute}
        onChange={async (h, m) => {
          await ensurePermission();
          await saveSetting('notify_morning', formatHHMM(h, m));
          await refreshNotifications();
        }}
      />
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>21時の日記リマインド</Text>
          <Text style={styles.switchDesc}>未記入のときだけ届く</Text>
        </View>
        <Switch
          value={eveningEnabled}
          onValueChange={async (v) => {
            await saveSetting('notify_evening_enabled', v ? '1' : '0');
            await refreshNotifications();
          }}
          trackColor={{ true: colors.blue, false: colors.line }}
        />
      </View>
    </Card>
  );
}

// ---------- 宣言文の管理 ----------

function AffirmationSection() {
  const affirmations = useAppStore((s) => s.affirmations);
  const addAffirmation = useAppStore((s) => s.addAffirmation);
  const editAffirmation = useAppStore((s) => s.editAffirmation);
  const toggleAffirmation = useAppStore((s) => s.toggleAffirmation);
  const removeAffirmation = useAppStore((s) => s.removeAffirmation);

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');

  const startEdit = (a: Affirmation) => {
    setEditingId(a.id);
    setText(a.text);
    setTag(a.tag ?? '');
  };

  const save = async () => {
    const t = text.trim();
    if (!t) return;
    if (editingId === 'new') {
      await addAffirmation({ text: t, tag: tag.trim() || null, goal_id: null });
    } else if (typeof editingId === 'number') {
      await editAffirmation(editingId, t, tag.trim() || null);
    }
    setEditingId(null);
  };

  return (
    <Card style={{ gap: 10, marginBottom: 14 }}>
      <SectionLabel en="DECLARE" jp="宣言文の管理" />
      {affirmations.map((a) => {
        if (editingId === a.id) {
          return (
            <View key={a.id} style={styles.editBox}>
              <Field multiline value={text} onChangeText={setText} autoFocus />
              <Field value={tag} onChangeText={setTag} placeholder="タグ(任意)" />
              <View style={styles.actions}>
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
          <View key={a.id} style={[styles.affRow, a.active === 0 && { opacity: 0.45 }]}>
            <Pressable style={{ flex: 1 }} onPress={() => startEdit(a)}>
              <Text style={styles.affText}>{a.text}</Text>
              {a.tag ? <Text style={styles.affTag}>{a.tag}</Text> : null}
            </Pressable>
            <Switch
              value={a.active === 1}
              onValueChange={(v) => toggleAffirmation(a.id, v)}
              trackColor={{ true: colors.blue, false: colors.line }}
            />
          </View>
        );
      })}
      {editingId === 'new' ? (
        <View style={styles.editBox}>
          <Field multiline value={text} onChangeText={setText} placeholder="私は、◯◯している。" autoFocus />
          <Field value={tag} onChangeText={setTag} placeholder="タグ(任意)" />
          <View style={styles.actions}>
            <GhostButton title="やめる" onPress={() => setEditingId(null)} style={{ flex: 1 }} />
            <PrimaryButton title="追加" onPress={save} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <GhostButton
          title="＋ 宣言文を追加"
          onPress={() => {
            if (!canAddAffirmation(affirmations.length)) {
              Alert.alert('BYME Pro', '無料プランの宣言文は3つまで。Proで無制限に。');
              return;
            }
            setEditingId('new');
            setText('');
            setTag('');
          }}
        />
      )}
    </Card>
  );
}

// ---------- データエクスポート ----------

function ExportSection() {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);

  return (
    <Card style={{ gap: 10, marginBottom: 14 }}>
      <SectionLabel en="DATA" jp="データ" />
      <GhostButton
        title={busy ? 'エクスポート中…' : 'すべてのデータを書き出す(JSON)'}
        onPress={async () => {
          setBusy(true);
          try {
            const data = await exportAll(db);
            await Share.share({ message: JSON.stringify(data, null, 2) });
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      />
    </Card>
  );
}

// ---------- アプリ情報 ----------

function AboutSection() {
  const settings = useAppStore((s) => s.settings);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const [endpoint, setEndpoint] = useState(settings.ai_endpoint ?? '');

  return (
    <Card style={{ gap: 10 }}>
      <SectionLabel en="ACCOUNT" jp="アカウント" />
      <Text style={styles.note}>アカウント同期はPhase 2で提供予定。データは端末内に保存されている。</Text>

      <SectionLabel en="AI ENDPOINT" jp="AI変換サーバー(上級者向け)" />
      <Field
        value={endpoint}
        onChangeText={setEndpoint}
        placeholder="https://…(空欄でビルド時設定を使用)"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <GhostButton
        title="AI設定を保存"
        onPress={() => saveSetting('ai_endpoint', endpoint.trim())}
      />
      <Text style={styles.brand}>BYME — Life, by me.</Text>
    </Card>
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchTitle: {
    fontFamily: fonts.jpMedium,
    fontSize: 14,
    color: colors.ink,
  },
  switchDesc: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
    marginTop: 2,
  },
  affRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingBottom: 10,
  },
  affText: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 21,
    color: colors.ink,
  },
  affTag: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
    marginTop: 2,
  },
  editBox: {
    gap: 8,
    backgroundColor: colors.paper,
    borderRadius: 12,
    padding: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  note: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  brand: {
    fontFamily: fonts.en,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.mist,
    textAlign: 'center',
    marginTop: 8,
  },
});
