import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Field, PrimaryButton, SectionLabel } from '../../components/ui';
import { generateIdentityMvv } from '../../lib/ai';
import { useAppStore } from '../../store/useAppStore';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { colors, fonts, spacing } from '../../theme/tokens';

export default function IdentityMvv() {
  const aiEndpoint = useAppStore((s) => s.settings.ai_endpoint);
  const {
    identityInput,
    valuesInput,
    identityMvv,
    identityFromAi,
    setIdentityInput,
    setValuesInput,
    setIdentityMvv,
    patchIdentityMvv,
  } = useOnboardingStore();
  const [loading, setLoading] = useState(false);
  const [valuesText, setValuesText] = useState('');

  const generate = async () => {
    setLoading(true);
    const result = await generateIdentityMvv(identityInput, valuesInput, aiEndpoint);
    setIdentityMvv(result.data, result.fromAi);
    setValuesText(result.data.values.join('\n'));
    setLoading(false);
  };

  const confirm = () => {
    if (!identityMvv) return;
    patchIdentityMvv({
      values: valuesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    router.push('/(onboarding)/goals-input');
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SectionLabel en="IDENTITY" jp="なりたい自分" />
          <Text style={styles.lead}>
            あなたは、何者になるのか。{'\n'}自由に書けば、AIが「私は、◯◯である」の一文に磨き上げる。
          </Text>

          <Field
            multiline
            value={identityInput}
            onChangeText={setIdentityInput}
            placeholder="例: 事業で人の可能性を広げる経営者になりたい"
          />
          <Field
            multiline
            value={valuesInput}
            onChangeText={setValuesInput}
            placeholder="大切にしたいこと(例: 誠実さ、スピード、家族との時間)"
            style={{ marginTop: spacing.gap }}
          />

          <PrimaryButton
            title={identityMvv ? 'REGENERATE / もう一度生成' : 'GENERATE / AIで生成'}
            onPress={generate}
            disabled={loading || identityInput.trim().length === 0}
            style={{ marginTop: 16 }}
          />
          {loading ? <ActivityIndicator color={colors.blue} style={{ marginTop: 16 }} /> : null}

          {identityMvv && !loading ? (
            <Card style={{ marginTop: 20, gap: 14 }}>
              {!identityFromAi ? (
                <Text style={styles.fallbackNote}>
                  ※ オフライン変換です。そのまま編集して確定できます。
                </Text>
              ) : null}
              <SectionLabel en="IDENTITY" jp="アイデンティティ宣言文(編集可)" />
              <Field
                multiline
                value={identityMvv.identity}
                onChangeText={(t) => patchIdentityMvv({ identity: t })}
                style={styles.identityField}
              />
              <SectionLabel en="MISSION" jp="使命(編集可)" />
              <Field
                multiline
                value={identityMvv.mission}
                onChangeText={(t) => patchIdentityMvv({ mission: t })}
              />
              <SectionLabel en="VISION" jp="未来の姿(編集可)" />
              <Field
                multiline
                value={identityMvv.vision}
                onChangeText={(t) => patchIdentityMvv({ vision: t })}
              />
              <SectionLabel en="VALUE" jp="行動指針3カ条(編集可)" />
              <Field multiline value={valuesText} onChangeText={setValuesText} />
              <PrimaryButton title="NEXT / これで確定" onPress={confirm} />
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  fallbackNote: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  identityField: {
    fontFamily: fonts.jpBlack,
    fontSize: 16,
  },
});
