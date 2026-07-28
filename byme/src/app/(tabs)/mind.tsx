import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CREED, PRINCIPLE_CATEGORIES } from '../../data/master';
import { useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

/**
 * MIND = ライブラリの入口。
 * 戒め/アファメーション/心得カテゴリの一覧から各詳細へドリルダウンする。
 * 各行に件数と「今日読んだ数」を表示する。
 */
export default function Mind() {
  const principles = useAppStore((s) => s.principles);
  const readsToday = useAppStore((s) => s.readsToday);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 戒め3カ条(常時表示) */}
        <View style={styles.creedCard}>
          <Text style={styles.creedLabel}>CREED — 2026年 戒め</Text>
          {CREED.map((c, i) => (
            <Text key={i} style={styles.creedText}>
              一、{c}
            </Text>
          ))}
        </View>

        {/* 心得ライブラリ(カテゴリ一覧) */}
        <Text style={styles.secLabel}>LIBRARY — 心得ライブラリ</Text>
        <View style={styles.listCard}>
          {PRINCIPLE_CATEGORIES.map((cat) => {
            const items = principles.filter((p) => p.category === cat);
            const read = items.filter((p) => readsToday.principle.includes(p.id)).length;
            return (
              <Pressable
                key={cat}
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: '/library/[category]', params: { category: cat } })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{cat}</Text>
                  <Text style={styles.rowMeta}>{items.length}項目</Text>
                </View>
                <Text style={[styles.rowRead, read === items.length && items.length > 0 && styles.rowReadAll]}>
                  今日 {read}/{items.length}
                </Text>
                <Text style={styles.chev}>▸</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    paddingBottom: 40,
  },
  creedCard: {
    marginHorizontal: spacing.screenX,
    marginTop: 16,
    backgroundColor: colors.ink,
    borderRadius: 14,
    padding: 20,
  },
  creedLabel: {
    ...enLabel,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  creedText: {
    fontFamily: fonts.jpBold,
    fontSize: 15,
    lineHeight: 30,
    color: colors.white,
  },
  chev: {
    color: colors.blue,
    fontSize: 15,
  },
  secLabel: {
    ...enLabel,
    fontSize: 11,
    color: colors.mist,
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: spacing.screenX,
  },
  listCard: {
    marginHorizontal: spacing.screenX,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowName: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
    marginTop: 2,
  },
  rowRead: {
    fontFamily: fonts.en,
    fontSize: 11,
    color: colors.mist,
  },
  rowReadAll: {
    color: colors.blueDeep,
    fontFamily: fonts.enSemi,
  },
});
