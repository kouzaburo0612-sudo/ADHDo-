import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PulsingTri, Tri, TriProgress } from '../components/tri';
import { activeAffirmations, useAppStore } from '../store/useAppStore';
import { colors, enLabel, fonts } from '../theme/tokens';

/**
 * 宣言モード(最重要機能)。
 * アクティブな宣言文を1つずつ全画面表示し、声に出して唱え、タップで次へ。
 * 全件完了で ritual_days.declared = 1。
 */
export default function DeclareMode() {
  const affirmations = useAppStore((s) => s.affirmations);
  const markRitual = useAppStore((s) => s.markRitual);
  const active = useMemo(() => activeAffirmations(affirmations), [affirmations]);

  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const advance = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (index + 1 < active.length) {
      setIndex(index + 1);
    } else {
      await markRitual('declared');
      setFinished(true);
    }
  };

  if (active.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Tri size={22} color={colors.blue} />
          <Text style={styles.emptyText}>アクティブな宣言がない。{'\n'}VISIONタブで目標を宣言に変えよう。</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.close}>閉じる</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (finished) {
    return (
      <SafeAreaView style={styles.root}>
        <Pressable style={styles.center} onPress={() => router.back()}>
          <Tri size={26} color={colors.blue} />
          <Text style={styles.completeEn}>DECLARED</Text>
          <Text style={styles.completeJp}>今日も、なりたい自分として生きる。</Text>
          <Text style={styles.tapHint}>タップして戻る</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const current = active[index];

  return (
    <SafeAreaView style={styles.root}>
      <Pressable style={styles.body} onPress={advance} accessibilityLabel="次の宣言へ">
        <View style={styles.top}>
          <PulsingTri size={26} />
          {current.tag ? <Text style={styles.tag}>{current.tag}</Text> : null}
          <Text style={styles.instruction}>声に出して唱える</Text>
        </View>

        <View style={styles.middle}>
          <Text style={styles.affirmation}>{current.text}</Text>
        </View>

        <View style={styles.bottom}>
          <TriProgress total={active.length} done={index + 1} size={8} />
          <Text style={styles.counter}>
            {index + 1} / {active.length}
          </Text>
          <Text style={styles.tapHint}>タップで次へ</Text>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  body: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  top: {
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  tag: {
    ...enLabel,
    fontSize: 11,
    color: colors.blue,
  },
  instruction: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.mist,
    letterSpacing: 2,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
  },
  affirmation: {
    fontFamily: fonts.jpBlack,
    fontSize: 28,
    lineHeight: 46,
    color: colors.ink,
    textAlign: 'center',
  },
  bottom: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  counter: {
    fontFamily: fonts.en,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.mist,
  },
  tapHint: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: fonts.jp,
    fontSize: 14,
    lineHeight: 24,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  close: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    color: colors.blue,
  },
  completeEn: {
    ...enLabel,
    fontSize: 16,
    color: colors.ink,
  },
  completeJp: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    color: colors.inkSoft,
  },
});
