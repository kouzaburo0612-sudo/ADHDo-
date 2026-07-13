import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, enLabel, fonts, radii, spacing } from '../theme/tokens';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** 英字ラベル + 日本語サブラベル(セクション見出し) */
export function SectionLabel({ en, jp }: { en: string; jp?: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionEn}>{en}</Text>
      {jp ? <Text style={styles.sectionJp}>{jp}</Text> : null}
    </View>
  );
}

export function Chip({ text, active = false }: { text: string; active?: boolean }) {
  return (
    <View style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={styles.primaryBtnText}>{title}</Text>
    </Pressable>
  );
}

export function GhostButton({
  title,
  onPress,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ghostBtn,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={styles.ghostBtnText}>{title}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.mist}
      {...props}
      style={[styles.field, props.multiline && styles.fieldMultiline, props.style]}
    />
  );
}

/** 行頭の ▸ 付きリスト行 */
export function TriListRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.triRow}>
      <Text style={styles.triMark}>▸</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.cardPad,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  sectionEn: {
    ...enLabel,
    fontSize: 13,
    color: colors.blue,
  },
  sectionJp: {
    fontFamily: fonts.jpMedium,
    fontSize: 11,
    color: colors.mist,
  },
  chip: {
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipActive: {
    backgroundColor: colors.bluePale,
    borderColor: colors.blue,
  },
  chipText: {
    ...enLabel,
    fontSize: 11,
    color: colors.inkSoft,
  },
  chipTextActive: {
    color: colors.blueDeep,
  },
  primaryBtn: {
    backgroundColor: colors.ink,
    borderRadius: radii.input,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    ...enLabel,
    color: colors.white,
    fontSize: 14,
  },
  ghostBtn: {
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  ghostBtnText: {
    fontFamily: fonts.jpMedium,
    color: colors.inkSoft,
    fontSize: 13,
  },
  field: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.jp,
    fontSize: 15,
    color: colors.ink,
  },
  fieldMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  triRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  triMark: {
    color: colors.blue,
    fontSize: 13,
    lineHeight: 20,
  },
});
