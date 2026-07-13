/**
 * 全タブ共通の固定ヘッダー。
 * Mr. Vyta(チャット)画面のヘッダー位置を正とし、全画面で同一の高さ・
 * 同一のコンポーネントを使うことでロゴのY座標ズレを構造的に防ぐ。
 * 必ずスクロール領域の「外」に置くこと(スクロールに巻き込むと位置が揃わない)。
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/BrandHeader';
import { Colors, Spacing } from '@/constants/theme';

export function AppHeader({ sub, left, right }: { sub?: string; left?: ReactNode; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.side}>{left}</View>
      <BrandHeader sub={sub} />
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  /* 左右を同幅にしてロゴを常に中央へ */
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sideRight: { justifyContent: 'flex-end' },
});
