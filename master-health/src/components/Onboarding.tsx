/** 初回起動時のみ表示するチュートリアル(kvフラグで一度きり) */
import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';

const SLIDES = [
  {
    emoji: '👋',
    title: 'VYTAへようこそ',
    body: 'AIと一緒に、体を数字で管理するパーソナル健康アプリです。WithingsやOuraのデータは自動で取り込まれます。',
  },
  {
    emoji: '📊',
    title: 'My Body',
    body: 'コンディション・睡眠・活動・体組成の4スコアと体重・体脂肪率を毎日チェック。スコアをタップすると根拠が見えます。画面を左右にスワイプすると過去の日に戻れます。',
  },
  {
    emoji: '🔥',
    title: 'カロリー赤字を積み上げよう',
    body: '消費より少なく食べた分が「脂肪燃焼」。赤字の累積7,200kcalで脂肪約1kgです。まずトレンドタブで目標体重と期日を設定しましょう。',
  },
  {
    emoji: '🍚',
    title: '実績報告',
    body: '食事は写真を撮るかバーコードをかざすだけで10秒記録。運動やストレスの報告もこのタブから。歩数や消費カロリーは自動連携なので記録不要です。',
  },
  {
    emoji: '💬',
    title: 'AIチャット',
    body: '「昼はいつもの」「ベンチ90lb 8回3セット」と話すだけで記録できます。毎朝の今日のプランと、月曜の週次レポートも自動で届きます。',
  },
];

export function Onboarding({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;
  const last = page === SLIDES.length - 1;

  const goNext = () => {
    if (last) { onDone(); return; }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <Modal visible={visible} animationType="fade">
      <View style={[styles.root, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable style={styles.skip} onPress={onDone} hitSlop={12}>
          <Text style={styles.skipText}>スキップ</Text>
        </Pressable>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {SLIDES.map((s) => (
            <View key={s.title} style={[styles.slide, { width }]}>
              <Text style={styles.emoji}>{s.emoji}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        <Pressable style={styles.nextBtn} onPress={goNext}>
          <Text style={styles.nextText}>{last ? 'はじめる' : '次へ'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  skip: { position: 'absolute', top: 60, right: Spacing.md, zIndex: 10 },
  skipText: { color: Colors.textFaint, fontSize: Type.body },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  emoji: { fontSize: 72 },
  title: {
    color: Colors.text, fontSize: 26, fontFamily: Fonts.sans, fontWeight: '700',
    marginTop: Spacing.lg, textAlign: 'center',
  },
  body: {
    color: Colors.textSecondary, fontSize: Type.body, lineHeight: 24,
    marginTop: Spacing.md, textAlign: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.surfaceRaised },
  dotActive: { backgroundColor: Colors.accent, width: 20 },
  nextBtn: {
    marginHorizontal: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.accent, paddingVertical: 16, alignItems: 'center',
  },
  nextText: { color: Colors.bg, fontSize: Type.body, fontWeight: '700' },
});
