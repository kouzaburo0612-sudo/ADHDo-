import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { TimeStepper } from '../components/time-stepper';
import { Card, GhostButton, SectionLabel } from '../components/ui';
import { exportAll } from '../db/queries';
import { formatHHMM, parseHHMM } from '../lib/dates';
import { ensurePermission } from '../lib/notifications';
import { useAppStore } from '../store/useAppStore';
import { colors, fonts, spacing } from '../theme/tokens';

export default function Settings() {
  const db = useSQLiteContext();
  const settings = useAppStore((s) => s.settings);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);
  const [busy, setBusy] = useState(false);

  const wake = parseHHMM(settings.wake_time ?? '') ?? { hour: 6, minute: 0 };
  const kpiEnabled = (settings.notify_kpi_enabled ?? '1') === '1';
  const extraEnabled = (settings.notify_extra_enabled ?? '1') === '1';
  const streakEnabled = (settings.notify_streak_enabled ?? '1') === '1';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionLabel en="SETTINGS" jp="設定" />

        <Card style={{ gap: 14, marginBottom: 14 }}>
          <SectionLabel en="WAKE TIME" jp="起床時刻(恒久ルール)" />
          <Text style={styles.note}>
            毎朝この時刻に、今日の指針が通知で届く。通知そのものが刷り込みになる。
          </Text>
          <TimeStepper
            hour={wake.hour}
            minute={wake.minute}
            onChange={async (h, m) => {
              await ensurePermission();
              await saveSetting('wake_time', formatHHMM(h, m));
              await refreshNotifications();
            }}
          />
        </Card>

        <Card style={{ gap: 14, marginBottom: 14 }}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>昼・夕の刷り込み通知</Text>
              <Text style={styles.switchDesc}>12:30 残り日数+指針 / 17:30 アファメーション</Text>
            </View>
            <Switch
              value={extraEnabled}
              onValueChange={async (v) => {
                await saveSetting('notify_extra_enabled', v ? '1' : '0');
                await refreshNotifications();
              }}
              trackColor={{ true: colors.blue, false: colors.line }}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>夜のストリーク防衛通知</Text>
              <Text style={styles.switchDesc}>未完了の日だけ21:30「◯日連続が今夜消える」</Text>
            </View>
            <Switch
              value={streakEnabled}
              onValueChange={async (v) => {
                await saveSetting('notify_streak_enabled', v ? '1' : '0');
                await refreshNotifications();
              }}
              trackColor={{ true: colors.blue, false: colors.line }}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>日曜夕のKPI更新催促</Text>
              <Text style={styles.switchDesc}>毎週日曜18:00「KPI現在値を更新せよ」</Text>
            </View>
            <Switch
              value={kpiEnabled}
              onValueChange={async (v) => {
                await saveSetting('notify_kpi_enabled', v ? '1' : '0');
                await refreshNotifications();
              }}
              trackColor={{ true: colors.blue, false: colors.line }}
            />
          </View>
        </Card>

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

        <Text style={styles.brand}>BYME — Life, by me.</Text>
      </ScrollView>
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
  note: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 20,
    color: colors.inkSoft,
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
  brand: {
    fontFamily: fonts.en,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.mist,
    textAlign: 'center',
    marginTop: 8,
  },
});
