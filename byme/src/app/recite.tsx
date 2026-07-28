import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tri } from '../components/tri';
import { useAppStore } from '../store/useAppStore';
import { colors, enLabel, fonts } from '../theme/tokens';

/**
 * 唱和モード: アファメーションを1篇ずつ全画面で表示し、声に出して唱える。
 * タップで次へ。各篇を表示した時点でその篇を「今日唱えた」に記録する。
 */
export default function Recite() {
  const affirmations = useAppStore((s) => s.affirmations);
  const markRead = useAppStore((s) => s.markRead);
  const [idx, setIdx] = useState(0);
  const [finished, setFinished] = useState(false);

  if (affirmations.length === 0) {
    router.back();
    return null;
  }

  const current = affirmations[Math.min(idx, affirmations.length - 1)];

  const advance = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await markRead('affirmation', current.id, true);
    if (idx + 1 < affirmations.length) {
      setIdx(idx + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFinished(true);
    }
  };

  if (finished) {
    return (
      <LinearGradient colors={['#0A1E2E', '#14405C', '#2E7196']} style={styles.fill}>
        <SafeAreaView style={styles.fill}>
          <Pressable style={styles.center} onPress={() => router.back()}>
            <Tri size={26} color={colors.white} />
            <Text style={styles.doneEn}>ALL RECITED</Text>
            <Text style={styles.doneJp}>{affirmations.length}篇、すべて唱えた。今日も、その男として生きる。</Text>
            <Text style={styles.hintCenter}>タップして戻る</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050B12', '#1B2430', '#1F4E6B']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <Pressable style={styles.body} onPress={advance} accessibilityLabel="次の篇へ">
          <View style={styles.progress}>
            {affirmations.map((_, i) => (
              <View key={i} style={[styles.seg, i <= idx && styles.segOn]} />
            ))}
          </View>

          <Pressable style={styles.close} hitSlop={8} onPress={() => router.back()}>
            <Text style={styles.closeText}>閉じる</Text>
          </Pressable>

          <View style={styles.content}>
            <Text style={styles.affTitle}>{current.title}</Text>
            <Text style={styles.affBody}>{current.body}</Text>
          </View>

          <Text style={styles.hint}>声に出して唱える — TAP</Text>
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
    gap: 5,
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
  },
  closeText: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.white,
  },
  content: {
    gap: 18,
  },
  affTitle: {
    ...enLabel,
    fontSize: 13,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.7)',
  },
  affBody: {
    fontFamily: fonts.jpBlack,
    fontSize: 24,
    lineHeight: 44,
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
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
  hintCenter: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
});
