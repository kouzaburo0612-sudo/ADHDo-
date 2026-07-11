/** 画面上部中央のVYTAワードマーク(ロゴのティールのダッシュを添える) */
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Type } from '@/constants/theme';

export function BrandHeader({ sub }: { sub?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.markRow}>
        <Text style={styles.wordmark} allowFontScaling={false}>VYTA</Text>
        <View style={styles.dash} />
      </View>
      {sub != null && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  markRow: { alignItems: 'center' },
  wordmark: {
    color: Colors.text,
    fontFamily: Fonts.brand,
    fontSize: 22,
    letterSpacing: 7,
    // letterSpacingは最後の文字の右にも付くため、中央に見えるよう補正
    marginRight: -7,
  },
  dash: {
    width: 18, height: 3, borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 3,
  },
  sub: { color: Colors.textSecondary, fontSize: Type.caption, marginTop: 5 },
});
