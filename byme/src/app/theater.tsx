import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { colors, enLabel, fonts } from '../theme/tokens';

/**
 * 上映モード(仕様6.3)。
 * シーンを順に全画面表示。唱える数字はストレッチ・未来値。
 * 「声に出して唱え、情景を見る」を常時表示。完了で daily_log.theater = 1。
 */
export default function Theater() {
  const scenes = useAppStore((s) => s.scenes);
  const setTodayField = useAppStore((s) => s.setTodayField);
  const [idx, setIdx] = useState(0);

  if (scenes.length === 0) {
    router.back();
    return null;
  }

  const scene = scenes[Math.min(idx, scenes.length - 1)];
  const gradient = scene.bg_gradient.split(',');
  const gradientColors: [string, string, string] = [
    gradient[0] ?? colors.ink,
    gradient[1] ?? colors.blueDeep,
    gradient[2] ?? colors.blue,
  ];

  const advance = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (idx + 1 < scenes.length) {
      setIdx(idx + 1);
    } else {
      await setTodayField('theater', true);
      router.back();
    }
  };

  return (
    <LinearGradient colors={gradientColors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <Pressable style={styles.body} onPress={advance} accessibilityLabel="次のシーンへ">
          {/* 進捗セグメント */}
          <View style={styles.progress}>
            {scenes.map((_, i) => (
              <View key={i} style={[styles.seg, i <= idx && styles.segOn]} />
            ))}
          </View>

          <Pressable style={styles.close} hitSlop={8} onPress={() => router.back()}>
            <Text style={styles.closeText}>閉じる</Text>
          </Pressable>

          <View style={styles.content}>
            <Text style={styles.tag}>{scene.tag}</Text>
            <Text style={styles.number}>{scene.number_text}</Text>
            <Text style={styles.caption}>{scene.caption}</Text>
            <Text style={styles.text}>{scene.body}</Text>
          </View>

          <Text style={styles.hint}>声に出して唱え、情景を見る — TAP</Text>
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
    paddingBottom: 40,
    justifyContent: 'flex-end',
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
    marginBottom: 60,
  },
  tag: {
    ...enLabel,
    fontSize: 12,
    letterSpacing: 6,
    color: 'rgba(255,255,255,0.75)',
  },
  number: {
    fontFamily: fonts.enSemi,
    fontSize: 76,
    lineHeight: 84,
    color: colors.white,
    marginTop: 10,
  },
  caption: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  text: {
    fontFamily: fonts.jpBlack,
    fontSize: 19,
    lineHeight: 38,
    color: colors.white,
    marginTop: 22,
  },
  hint: {
    position: 'absolute',
    bottom: 24,
    left: 30,
    fontFamily: fonts.jp,
    fontSize: 10,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.55)',
  },
});
