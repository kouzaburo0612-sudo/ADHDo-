import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type ViewStyle } from 'react-native';
import { colors } from '../theme/tokens';

/** ロゴ由来のシグネチャーモチーフ: 下向き三角形 ▼ */
export function Tri({
  size = 12,
  color = colors.blue,
  style,
}: {
  size?: number;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.62,
          borderRightWidth: size * 0.62,
          borderTopWidth: size,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
        },
        style,
      ]}
    />
  );
}

/** 進捗インジケーター: 小さな▼の列 */
export function TriProgress({
  total,
  done,
  size = 9,
}: {
  total: number;
  done: number;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <Tri key={i} size={size} color={i < done ? colors.blue : colors.line} />
      ))}
    </View>
  );
}

/** 宣言モードの脈打つ▼(reduced motion では静止) */
export function PulsingTri({ size = 28 }: { size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Tri size={size} color={colors.blue} />
    </Animated.View>
  );
}
