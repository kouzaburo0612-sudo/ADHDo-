import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Field, PrimaryButton, SectionLabel, TriListRow } from '../../components/ui';
import { GOAL_CATEGORY_LABELS } from '../../db/types';
import { convertGoals } from '../../lib/ai';
import { useAppStore } from '../../store/useAppStore';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { colors, fonts, spacing } from '../../theme/tokens';

export default function AiConvert() {
  const aiEndpoint = useAppStore((s) => s.settings.ai_endpoint);
  const { goals, conversions, conversionsFromAi, setConversions, patchConversion } =
    useOnboardingStore();
  const [loading, setLoading] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current || conversions.length > 0) return;
    requested.current = true;
    setLoading(true);
    convertGoals(
      goals.map((g) => g.title),
      aiEndpoint
    ).then((res) => {
      setConversions(res.data, res.fromAi);
      setLoading(false);
    });
  }, [goals, conversions.length, aiEndpoint, setConversions]);

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SectionLabel en="DECLARE" jp="宣言文への変換" />
          <Text style={styles.lead}>
            「〜したい」は、もう卒業。{'\n'}すべて現在進行形・完了形に変換した。編集して確定しよう。
          </Text>

          {loading ? (
            <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color={colors.blue} />
              <Text style={styles.loadingText}>変換中…</Text>
            </Card>
          ) : (
            conversions.map((c, i) => (
              <Card key={i} style={{ marginBottom: 14, gap: 10 }}>
                <Text style={styles.goalText}>
                  {goals[i] ? `${GOAL_CATEGORY_LABELS[goals[i].category].jp} ・ ` : ''}
                  {c.goal}
                </Text>
                <Field
                  multiline
                  value={c.affirmation}
                  onChangeText={(t) => patchConversion(i, t)}
                  style={styles.affirmationField}
                />
                <SectionLabel en="IMAGING" jp="さらに具体化するなら" />
                {c.suggestions.slice(0, 3).map((s, si) => (
                  <TriListRow key={si}>
                    <Text style={styles.suggestion}>{s}</Text>
                  </TriListRow>
                ))}
              </Card>
            ))
          )}

          {!loading && !conversionsFromAi && conversions.length > 0 ? (
            <Text style={styles.fallbackNote}>
              ※ AIに接続できなかったため自動変換しました。文面は自由に編集できます。
            </Text>
          ) : null}

          <PrimaryButton
            title="CONFIRM / この宣言で決める"
            onPress={() => router.push('/(onboarding)/principles-pick')}
            disabled={loading || conversions.length === 0}
            style={{ marginTop: 12 }}
          />
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
  loadingText: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.mist,
    marginTop: 12,
  },
  goalText: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.mist,
  },
  affirmationField: {
    fontFamily: fonts.jpBlack,
    fontSize: 16,
    lineHeight: 26,
  },
  suggestion: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  fallbackNote: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
    marginBottom: 8,
  },
});
