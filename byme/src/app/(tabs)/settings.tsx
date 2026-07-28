import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { Card, Field, GhostButton, SectionLabel } from '../../components/ui';
import { TimeStepper } from '../../components/time-stepper';
import { exportAll, insertItem } from '../../db/queries';
import type { ContentType, RitualMode, SettingKey } from '../../db/types';
import { formatHHMM, parseHHMM } from '../../lib/dates';
import { ensurePermission } from '../../lib/notifications';
import { useAppStore } from '../../store/useAppStore';
import { colors, fonts, spacing } from '../../theme/tokens';

/** SETTINGS: 通知・儀式モード・表示・音声・データ */

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function Settings() {
  const db = useSQLiteContext();
  const settings = useAppStore((s) => s.settings);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);
  const reload = useAppStore((s) => s.reload);
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState('');

  const wake = parseHHMM(settings.wake_time ?? '') ?? { hour: 6, minute: 0 };
  const bool = (key: SettingKey, def = '1') => (settings[key] ?? def) === '1';
  const days = (settings.notify_days ?? '0,1,2,3,4,5,6').split(',').filter((s) => s !== '').map(Number);
  const defaultMode = (settings.default_mode ?? 'standard') as RitualMode;
  const seconds = Number(settings.seconds_per_screen ?? '8') || 8;
  const fontScale = Number(settings.font_scale ?? '1') || 1;
  const imageDim = Number(settings.image_dim ?? '0.35') || 0.35;

  const setAndRefresh = async (key: SettingKey, value: string) => {
    await saveSetting(key, value);
    await refreshNotifications();
  };

  const toggleDay = async (d: number) => {
    const nextDays = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    if (nextDays.length === 0) return; // 全曜日オフは通知トグルで行う
    await setAndRefresh('notify_days', nextDays.join(','));
  };

  const doImport = async () => {
    try {
      const data = JSON.parse(importText);
      if (data.version !== 3 || !Array.isArray(data.items)) {
        Alert.alert('読み込めません', 'BYME v3のエクスポートJSONを貼り付けてください。');
        return;
      }
      setBusy(true);
      let added = 0;
      const existing = useAppStore.getState().items;
      for (const it of data.items) {
        const dupe = existing.some(
          (e) => e.type === it.type && e.title === it.title && e.body === it.body
        );
        if (dupe) continue;
        await insertItem(db, {
          type: it.type as ContentType,
          title: String(it.title ?? ''),
          body: String(it.body ?? ''),
          priority: Number(it.priority ?? 2),
          cadence: String(it.cadence ?? 'daily'),
          modes: String(it.modes ?? 'standard,full'),
          emphasis: Number(it.emphasis ?? 0),
          extra: typeof it.extra === 'string' ? JSON.parse(it.extra) : (it.extra ?? {}),
        });
        added += 1;
      }
      await reload();
      setImportText('');
      Alert.alert('インポート完了', `${added}件を追加しました(既存と同一の項目はスキップ)。`);
    } catch {
      Alert.alert('読み込めません', 'JSONの形式を確認してください。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SectionLabel en="SETTINGS" jp="設定" />

        {/* 儀式 */}
        <Card style={{ gap: 14, marginBottom: 14 }}>
          <SectionLabel en="RITUAL" jp="儀式" />
          <Text style={styles.label}>デフォルトモード</Text>
          <View style={styles.segRow}>
            {(['quick', 'standard', 'full'] as RitualMode[]).map((m) => (
              <Pressable
                key={m}
                style={[styles.segBtn, defaultMode === m && styles.segOn]}
                onPress={() => saveSetting('default_mode', m)}
              >
                <Text style={[styles.segText, defaultMode === m && styles.segTextOn]}>{m.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <SwitchRow
            title="自動送り"
            desc={`${seconds}秒ごとに次の画面へ(手動タップも常に有効)`}
            value={bool('auto_advance', '0')}
            onChange={(v) => saveSetting('auto_advance', v ? '1' : '0')}
          />
          <Stepper
            label="1画面の表示秒数"
            value={seconds}
            onChange={(v) => saveSetting('seconds_per_screen', String(Math.min(30, Math.max(3, v))))}
            unit="秒"
          />
          <SwitchRow
            title="アファメーションを1文ずつ表示"
            desc="オフにすると全文を1画面で表示"
            value={(settings.aff_display ?? 'split') === 'split'}
            onChange={(v) => saveSetting('aff_display', v ? 'split' : 'full')}
          />
          <SwitchRow
            title="音声読み上げ(OS標準)"
            desc="表示中の文章を日本語で読み上げる"
            value={bool('tts_enabled', '0')}
            onChange={(v) => saveSetting('tts_enabled', v ? '1' : '0')}
          />
          <SwitchRow
            title="ハプティクス"
            desc="タップ時の振動"
            value={bool('haptics_enabled')}
            onChange={(v) => saveSetting('haptics_enabled', v ? '1' : '0')}
          />
          <Stepper
            label="儀式画面の文字サイズ"
            value={Math.round(fontScale * 100)}
            step={10}
            onChange={(v) => saveSetting('font_scale', String(Math.min(140, Math.max(80, v)) / 100))}
            unit="%"
          />
          <Stepper
            label="背景画像の暗さ"
            value={Math.round(imageDim * 100)}
            step={5}
            onChange={(v) => saveSetting('image_dim', String(Math.min(80, Math.max(0, v)) / 100))}
            unit="%"
          />
          <Stepper
            label="FULLの最大件数"
            value={Number(settings.full_max_items ?? '40') || 40}
            step={5}
            onChange={(v) => saveSetting('full_max_items', String(Math.min(99, Math.max(10, v))))}
            unit="件"
          />
        </Card>

        {/* 通知 */}
        <Card style={{ gap: 14, marginBottom: 14 }}>
          <SectionLabel en="NOTIFICATIONS" jp="通知" />
          <Text style={styles.note}>
            朝は開始の合図。昼・夕・夜は「未完了の日だけ」届く。完了した日は鳴らない。
          </Text>
          <Text style={styles.label}>朝の開始通知(起床時刻)</Text>
          <TimeStepper
            hour={wake.hour}
            minute={wake.minute}
            onChange={async (h, m) => {
              await ensurePermission();
              await setAndRefresh('wake_time', formatHHMM(h, m));
            }}
          />
          <SwitchRow
            title="朝の開始通知"
            desc="「自分の人生を思い出す時間です。」"
            value={bool('notify_morning_enabled')}
            onChange={(v) => setAndRefresh('notify_morning_enabled', v ? '1' : '0')}
          />
          <SwitchRow
            title="昼の再通知(12:30)"
            desc="未完了のときだけ"
            value={bool('notify_noon_enabled')}
            onChange={(v) => setAndRefresh('notify_noon_enabled', v ? '1' : '0')}
          />
          <SwitchRow
            title="夕方の再通知(17:30)"
            desc="未完了のときだけ"
            value={bool('notify_evening_enabled')}
            onChange={(v) => setAndRefresh('notify_evening_enabled', v ? '1' : '0')}
          />
          <SwitchRow
            title="夜の最終通知(21:30)"
            desc="「60秒のQUICKだけでも、今日をゼロにしない。」"
            value={bool('notify_night_enabled')}
            onChange={(v) => setAndRefresh('notify_night_enabled', v ? '1' : '0')}
          />
          <Text style={styles.label}>通知する曜日</Text>
          <View style={styles.segRow}>
            {WEEKDAY_LABELS.map((w, d) => (
              <Pressable
                key={d}
                style={[styles.dayBtn, days.includes(d) && styles.segOn]}
                onPress={() => toggleDay(d)}
              >
                <Text style={[styles.segText, days.includes(d) && styles.segTextOn]}>{w}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* 表示 */}
        <Card style={{ gap: 14, marginBottom: 14 }}>
          <SectionLabel en="DISPLAY" jp="表示" />
          <SwitchRow
            title="ストリーク表示"
            desc="TODAYに連続日数を出す"
            value={bool('show_streak')}
            onChange={(v) => saveSetting('show_streak', v ? '1' : '0')}
          />
          <SwitchRow
            title="実施率表示"
            desc="TODAYに直近30日の実施率を出す"
            value={bool('show_rate')}
            onChange={(v) => saveSetting('show_rate', v ? '1' : '0')}
          />
        </Card>

        {/* データ */}
        <Card style={{ gap: 10, marginBottom: 14 }}>
          <SectionLabel en="DATA" jp="データ" />
          <GhostButton
            title={busy ? '処理中…' : 'すべてのデータを書き出す(JSON)'}
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
          <Text style={styles.note}>
            インポート: 書き出したJSONを下に貼り付けて実行(既存と同一の項目はスキップ)。
          </Text>
          <Field
            placeholder='{"version":3, ...}'
            value={importText}
            onChangeText={setImportText}
            multiline
            style={{ minHeight: 70 }}
          />
          <GhostButton title="インポート実行" onPress={doImport} disabled={busy || importText.trim() === ''} />
        </Card>

        <Text style={styles.brand}>BYME — Life, by me.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SwitchRow({
  title,
  desc,
  value,
  onChange,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchTitle}>{title}</Text>
        <Text style={styles.switchDesc}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.blue, false: colors.line }} />
    </View>
  );
}

function Stepper({
  label,
  value,
  onChange,
  unit,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchTitle, { flex: 1 }]}>{label}</Text>
      <Pressable onPress={() => onChange(value - step)} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>
        {value}
        {unit}
      </Text>
      <Pressable onPress={() => onChange(value + step)} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
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
    paddingBottom: 48,
  },
  note: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  label: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.mist,
  },
  segRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  dayBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  segOn: {
    borderColor: colors.blue,
    backgroundColor: colors.bluePale,
  },
  segText: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  segTextOn: {
    color: colors.blueDeep,
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
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 17,
    color: colors.ink,
  },
  stepValue: {
    fontFamily: fonts.enSemi,
    fontSize: 14,
    color: colors.ink,
    minWidth: 52,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
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
