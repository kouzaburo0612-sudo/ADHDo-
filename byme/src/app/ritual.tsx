import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tri } from '../components/tri';
import { DEADLINE_2026, DEADLINE_IPO } from '../data/master';
import type { Affirmation, Scene } from '../db/types';
import { daysUntil } from '../lib/dates';
import { todaysCreed, todaysPrinciple, useAppStore } from '../store/useAppStore';
import { colors, enLabel, fonts } from '../theme/tokens';

/**
 * 朝のオートパイロット: 判断ゼロの一本道。
 * 指針 → 数字と残日数 → 上映(全シーン) → 唱和(全篇) → 完了。
 * タップは「次へ」だけ。通過とともに指針・上映・唱和の完了が記録される。
 * (BODY3つは身体で実行するものなので、完了画面でリマインドに留める)
 */

type Step =
  | { kind: 'guidance' }
  | { kind: 'numbers' }
  | { kind: 'scene'; scene: Scene }
  | { kind: 'affirmation'; affirmation: Affirmation }
  | { kind: 'done' };

const DARK: [string, string, string] = ['#050B12', '#1B2430', '#1F4E6B'];
const FINALE: [string, string, string] = ['#0A1E2E', '#14405C', '#2E7196'];

export default function Ritual() {
  const scenes = useAppStore((s) => s.scenes);
  const affirmations = useAppStore((s) => s.affirmations);
  const kpis = useAppStore((s) => s.kpis);
  const streak = useAppStore((s) => s.streak);
  const principles = useAppStore((s) => s.principles);
  const setTodayField = useAppStore((s) => s.setTodayField);
  const markRead = useAppStore((s) => s.markRead);

  const steps = useMemo<Step[]>(
    () => [
      { kind: 'guidance' },
      { kind: 'numbers' },
      ...scenes.map((scene): Step => ({ kind: 'scene', scene })),
      ...affirmations.map((affirmation): Step => ({ kind: 'affirmation', affirmation })),
      { kind: 'done' },
    ],
    [scenes, affirmations]
  );

  const [idx, setIdx] = useState(0);
  const step = steps[Math.min(idx, steps.length - 1)];
  const principle = todaysPrinciple(principles);

  const advance = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // いま表示していたステップの完了を記録してから進む
    if (step.kind === 'guidance') {
      await setTodayField('principle', true);
      if (principle) await markRead('principle', principle.id, true);
    } else if (step.kind === 'scene') {
      const isLastScene = idx + 1 < steps.length && steps[idx + 1].kind !== 'scene';
      if (isLastScene) await setTodayField('theater', true);
    } else if (step.kind === 'affirmation') {
      await markRead('affirmation', step.affirmation.id, true);
    }

    if (step.kind === 'done') {
      router.back();
      return;
    }
    if (steps[idx + 1].kind === 'done') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setIdx(idx + 1);
  };

  const gradient: [string, string, string] =
    step.kind === 'scene'
      ? (() => {
          const g = step.scene.bg_gradient.split(',');
          return [g[0] ?? DARK[0], g[1] ?? DARK[1], g[2] ?? DARK[2]];
        })()
      : step.kind === 'done'
        ? FINALE
        : DARK;

  return (
    <LinearGradient colors={gradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <Pressable style={styles.body} onPress={advance} accessibilityLabel="次へ">
          {/* 進捗 */}
          <View style={styles.progress}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.seg, i <= idx && styles.segOn]} />
            ))}
          </View>

          <Pressable style={styles.close} hitSlop={8} onPress={() => router.back()}>
            <Text style={styles.closeText}>閉じる</Text>
          </Pressable>

          {step.kind === 'guidance' ? (
            <View style={styles.content}>
              <Text style={styles.tag}>TODAY’S CREED</Text>
              <Text style={styles.bigText}>{todaysCreed()}</Text>
              {principle ? (
                <Text style={styles.subText}>
                  {principle.category} — {principle.text}
                </Text>
              ) : null}
            </View>
          ) : null}

          {step.kind === 'numbers' ? (
            <View style={styles.content}>
              <Text style={styles.tag}>THE NUMBERS</Text>
              <View style={styles.daysRow}>
                <Text style={styles.daysNum}>{daysUntil(DEADLINE_2026)}</Text>
                <Text style={styles.daysUnit}>DAYS TO 2026</Text>
              </View>
              {kpis.map((k) => (
                <View key={k.id} style={styles.kpiRow}>
                  <Text style={styles.kpiLabel}>{k.label}</Text>
                  <Text style={styles.kpiValue}>
                    {k.current_value} / {k.commit_value}
                    {k.unit}
                  </Text>
                </View>
              ))}
              <Text style={styles.subText}>
                1日も、1円も、ごまかせない。/ 2034年IPOまで {daysUntil(DEADLINE_IPO)}日
              </Text>
            </View>
          ) : null}

          {step.kind === 'scene' ? (
            <View style={styles.content}>
              <Text style={styles.tag}>{step.scene.tag}</Text>
              <Text style={styles.sceneNumber}>{step.scene.number_text}</Text>
              <Text style={styles.sceneCaption}>{step.scene.caption}</Text>
              <Text style={styles.bigText}>{step.scene.body}</Text>
            </View>
          ) : null}

          {step.kind === 'affirmation' ? (
            <View style={styles.content}>
              <Text style={styles.tag}>{step.affirmation.title}</Text>
              <Text style={styles.bigText}>{step.affirmation.body}</Text>
            </View>
          ) : null}

          {step.kind === 'done' ? (
            <View style={styles.doneCenter}>
              <Tri size={26} color={colors.white} />
              <Text style={styles.doneEn}>RITUAL COMPLETE</Text>
              <Text style={styles.doneJp}>
                指針・数字・上映・唱和、すべて完了。{'\n'}残るはBODY3つ(瞑想・食事・筋トレ)だけだ。
              </Text>
              <Text style={styles.doneStreak}>▼ {streak}日連続</Text>
            </View>
          ) : null}

          <Text style={styles.hint}>
            {step.kind === 'done'
              ? 'タップして戻る'
              : step.kind === 'guidance' || step.kind === 'affirmation' || step.kind === 'scene'
                ? '声に出して唱える — TAP'
                : '目に焼き付ける — TAP'}
          </Text>
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  progress: {
    position: 'absolute',
    top: 16,
    left: 30,
    right: 30,
    flexDirection: 'row',
    gap: 3,
  },
  seg: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segOn: {
    backgroundColor: colors.white,
  },
  close: {
    position: 'absolute',
    top: 32,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 1,
  },
  closeText: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.white,
  },
  content: {
    gap: 14,
  },
  tag: {
    ...enLabel,
    fontSize: 12,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.7)',
  },
  bigText: {
    fontFamily: fonts.jpBlack,
    fontSize: 22,
    lineHeight: 40,
    color: colors.white,
  },
  subText: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.65)',
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  daysNum: {
    fontFamily: fonts.enSemi,
    fontSize: 72,
    lineHeight: 80,
    color: '#E88A85',
  },
  daysUnit: {
    ...enLabel,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
  },
  kpiLabel: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  kpiValue: {
    fontFamily: fonts.en,
    fontSize: 14,
    color: colors.white,
  },
  sceneNumber: {
    fontFamily: fonts.enSemi,
    fontSize: 68,
    lineHeight: 76,
    color: colors.white,
  },
  sceneCaption: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.75)',
  },
  doneCenter: {
    alignItems: 'center',
    gap: 16,
  },
  doneEn: {
    ...enLabel,
    fontSize: 16,
    color: colors.white,
  },
  doneJp: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  doneStreak: {
    fontFamily: fonts.enSemi,
    fontSize: 14,
    color: colors.white,
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    left: 30,
    fontFamily: fonts.jp,
    fontSize: 10,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.55)',
  },
});
