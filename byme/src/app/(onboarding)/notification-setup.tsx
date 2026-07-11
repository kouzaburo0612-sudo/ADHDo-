import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, PrimaryButton, SectionLabel } from '../../components/ui';
import { TimeStepper } from '../../components/time-stepper';
import { PRINCIPLE_TEMPLATES } from '../../data/presets';
import { formatHHMM } from '../../lib/dates';
import { ensurePermission } from '../../lib/notifications';
import { useAppStore } from '../../store/useAppStore';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { colors, fonts, spacing } from '../../theme/tokens';

export default function NotificationSetup() {
  const params = useLocalSearchParams<{ template?: string }>();
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(30);
  const [evening, setEvening] = useState(true);
  const [saving, setSaving] = useState(false);

  const app = useAppStore();
  const onboarding = useOnboardingStore();

  const finish = async () => {
    setSaving(true);
    try {
      await ensurePermission();

      // 1) アイデンティティ・MVV
      const mvv = onboarding.identityMvv;
      if (mvv) {
        await app.saveSetting('identity', mvv.identity.trim());
        await app.saveSetting('mvv_mission', mvv.mission.trim());
        await app.saveSetting('mvv_vision', mvv.vision.trim());
        await app.saveSetting('mvv_value', mvv.values.join('\n'));
      }

      // 2) 目標 + 宣言文(変換結果と紐づけて保存)
      for (let i = 0; i < onboarding.goals.length; i++) {
        const g = onboarding.goals[i];
        const goalId = await app.addGoal(g);
        const conv = onboarding.conversions[i];
        if (conv) {
          await app.addAffirmation({
            text: conv.affirmation.trim(),
            tag: null,
            goal_id: goalId,
          });
        }
      }

      // 3) 心得プリセット
      const template =
        PRINCIPLE_TEMPLATES.find((t) => t.key === params.template) ?? PRINCIPLE_TEMPLATES[0];
      await app.installPresets(template.items);

      // 4) 通知設定 + 完了フラグ
      await app.saveSetting('notify_morning', formatHHMM(hour, minute));
      await app.saveSetting('notify_evening_enabled', evening ? '1' : '0');
      await app.saveSetting('onboarding_done', '1');
      await app.refreshNotifications();

      onboarding.reset();
      router.replace('/(tabs)/today');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionLabel en="MORNING" jp="朝の儀式の時刻" />
        <Text style={styles.lead}>
          毎朝この時刻に、その日の宣言文が通知で届く。{'\n'}通知そのものがアファメーションになる。
        </Text>

        <Card style={{ paddingVertical: 28 }}>
          <TimeStepper hour={hour} minute={minute} onChange={(h, m) => { setHour(h); setMinute(m); }} />
        </Card>

        <Card style={styles.eveningRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eveningTitle}>21時の日記リマインド</Text>
            <Text style={styles.eveningDesc}>その日の日記が未記入のときだけ届く</Text>
          </View>
          <Switch
            value={evening}
            onValueChange={setEvening}
            trackColor={{ true: colors.blue, false: colors.line }}
          />
        </Card>

        <PrimaryButton
          title="BEGIN / 儀式をはじめる"
          onPress={finish}
          disabled={saving}
          style={{ marginTop: 20 }}
        />
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
  lead: {
    fontFamily: fonts.jp,
    fontSize: 13,
    lineHeight: 22,
    color: colors.inkSoft,
    marginBottom: 16,
  },
  eveningRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eveningTitle: {
    fontFamily: fonts.jpMedium,
    fontSize: 14,
    color: colors.ink,
  },
  eveningDesc: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
    marginTop: 2,
  },
});
