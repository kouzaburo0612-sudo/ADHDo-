/** 総合健康スコアのリング表示(Skia描画 + カウントアップ) */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCountUp } from '@/components/ui';
import { Colors, Fonts, Type, scoreColor } from '@/constants/theme';

const SIZE = 216;
const STROKE = 14;

export function ScoreRing({ score }: { score: number | null }) {
  const display = useCountUp(score);
  const color = scoreColor(score);

  const { track, arc } = useMemo(() => {
    const r = (SIZE - STROKE) / 2;
    const rect = { x: STROKE / 2, y: STROKE / 2, width: r * 2, height: r * 2 };
    const track = Skia.Path.Make();
    track.addArc(rect, -90, 360);
    const arc = Skia.Path.Make();
    arc.addArc(rect, -90, 360 * ((score ?? 0) / 100));
    return { track, arc };
  }, [score]);

  return (
    <View style={styles.wrap}>
      <Canvas style={{ width: SIZE, height: SIZE }}>
        <Path path={track} style="stroke" strokeWidth={STROKE} color={Colors.surfaceRaised} strokeCap="round" />
        {score != null && (
          <Path path={arc} style="stroke" strokeWidth={STROKE} color={color} strokeCap="round" />
        )}
      </Canvas>
      <View style={styles.center}>
        <Text style={[styles.value, { color: score == null ? Colors.textFaint : Colors.text }]}>
          {display ?? '–'}
        </Text>
        <Text style={styles.label}>総合スコア</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
  value: {
    fontSize: Type.hero,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: Type.hero * 1.05,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Type.label,
    letterSpacing: 1.5,
    marginTop: 2,
  },
});
