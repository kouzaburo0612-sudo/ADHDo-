import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

/**
 * 時刻ピッカー(依存を増やさないシンプルなステッパー)。
 * 時は1時間、分は5分刻み。
 */
export function TimeStepper({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const step = (dh: number, dm: number) => {
    let h = hour;
    let m = minute + dm;
    if (m >= 60) m = 0;
    if (m < 0) m = 55;
    h = (h + dh + 24) % 24;
    onChange(h, m);
  };

  return (
    <View style={styles.row}>
      <StepColumn value={String(hour).padStart(2, '0')} onUp={() => step(1, 0)} onDown={() => step(-1, 0)} />
      <Text style={styles.colon}>:</Text>
      <StepColumn value={String(minute).padStart(2, '0')} onUp={() => step(0, 5)} onDown={() => step(0, -5)} />
    </View>
  );
}

function StepColumn({ value, onUp, onDown }: { value: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={styles.col}>
      <Pressable accessibilityRole="button" accessibilityLabel="増やす" onPress={onUp} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepText}>▲</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="減らす" onPress={onDown} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepText}>▼</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  col: {
    alignItems: 'center',
    gap: 2,
  },
  colon: {
    fontFamily: fonts.enSemi,
    fontSize: 34,
    color: colors.ink,
    marginBottom: 6,
  },
  value: {
    fontFamily: fonts.enSemi,
    fontSize: 40,
    color: colors.ink,
    minWidth: 64,
    textAlign: 'center',
  },
  stepBtn: {
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  stepText: {
    color: colors.blue,
    fontSize: 14,
  },
});
