import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CREED, PRINCIPLE_CATEGORIES } from '../../data/master';
import { todaysPrinciple, useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

/**
 * 心得ライブラリ: カテゴリ別に全項目を常時閲覧。項目ごとにオン/オフ切替
 * (オフはローテーション対象外)。アファメーション5篇の全文もここ。
 */
export default function Mind() {
  const principles = useAppStore((s) => s.principles);
  const affirmations = useAppStore((s) => s.affirmations);
  const togglePrinciple = useAppStore((s) => s.togglePrinciple);
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);
  const today = todaysPrinciple(principles);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 戒め3カ条 */}
        <View style={styles.creedCard}>
          <Text style={styles.creedLabel}>CREED — 2026年 戒め</Text>
          {CREED.map((c, i) => (
            <Text key={i} style={styles.creedText}>
              一、{c}
            </Text>
          ))}
        </View>

        {/* 心得ライブラリ */}
        {PRINCIPLE_CATEGORIES.map((cat) => {
          const items = principles.filter((p) => p.category === cat);
          if (items.length === 0) return null;
          return (
            <View key={cat} style={styles.section}>
              <Text style={styles.catName}>{cat}</Text>
              <View style={styles.card}>
                {items.map((p) => (
                  <View key={p.id} style={[styles.row, p.active === 0 && { opacity: 0.45 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemText}>{p.text}</Text>
                      {today?.id === p.id ? (
                        <Text style={styles.todayBadge}>TODAY</Text>
                      ) : null}
                    </View>
                    <Switch
                      value={p.active === 1}
                      onValueChange={async (v) => {
                        await togglePrinciple(p.id, v);
                        await refreshNotifications();
                      }}
                      trackColor={{ true: colors.blue, false: colors.line }}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {/* アファメーション5篇 */}
        <View style={styles.section}>
          <Text style={styles.affHead}>AFFIRMATIONS — 上映用・5篇</Text>
          {affirmations.map((a) => (
            <View key={a.id} style={styles.affCard}>
              <Text style={styles.affTitle}>{a.title}</Text>
              <Text style={styles.affBody}>{a.body}</Text>
            </View>
          ))}
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
  section: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 18,
  },
  catName: {
    fontFamily: fonts.enSemi,
    letterSpacing: 2,
    fontSize: 13,
    color: colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: colors.blue,
    alignSelf: 'flex-start',
    paddingBottom: 4,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  itemText: {
    fontFamily: fonts.jpMedium,
    fontSize: 13,
    lineHeight: 22,
    color: colors.inkSoft,
  },
  todayBadge: {
    ...enLabel,
    fontSize: 9,
    color: colors.blueDeep,
    backgroundColor: colors.bluePale,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  affHead: {
    ...enLabel,
    fontSize: 11,
    color: colors.mist,
    marginBottom: 10,
  },
  affCard: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  affTitle: {
    fontFamily: fonts.jpBold,
    fontSize: 13,
    color: colors.blueDeep,
    marginBottom: 6,
  },
  affBody: {
    fontFamily: fonts.jpBlack,
    fontSize: 14,
    lineHeight: 26,
    color: colors.ink,
  },
});
