/** 小さな共有UI部品 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      hitSlop={4}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segment, value === o.value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === o.value && styles.segmentTextActive]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** 数値のカウントアップ表示(スコア更新時のみのアニメーション) */
export function useCountUp(target: number | null, duration = 700): number | null {
  const [display, setDisplay] = useState<number | null>(target);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) { setDisplay(null); prev.current = null; return; }
    const from = prev.current ?? 0;
    prev.current = target;
    if (from === target) { setDisplay(target); return; }
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: Type.label,
    fontFamily: Fonts.sans,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  chipText: { color: Colors.textSecondary, fontSize: Type.body },
  chipTextActive: { color: Colors.text, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.sm - 3,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: Colors.surfaceRaised },
  segmentText: { color: Colors.textSecondary, fontSize: Type.body },
  segmentTextActive: { color: Colors.text, fontWeight: '600' },
});
