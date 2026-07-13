import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, PrimaryButton, SectionLabel } from '../../components/ui';
import { Tri } from '../../components/tri';
import { PRINCIPLE_TEMPLATES, type PrincipleTemplate } from '../../data/presets';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

export default function PrinciplesPick() {
  const [selected, setSelected] = useState<PrincipleTemplate['key']>('ceo');

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionLabel en="MIND" jp="心得テンプレート" />
        <Text style={styles.lead}>
          毎朝1つだけ届く「今日の心得」。{'\n'}あなたに合うテンプレートを選ぶ(あとで追加・編集できる)。
        </Text>

        {PRINCIPLE_TEMPLATES.map((t) => {
          const active = selected === t.key;
          return (
            <Pressable key={t.key} onPress={() => setSelected(t.key)}>
              <Card style={[styles.tpl, active && styles.tplActive]}>
                <View style={styles.tplHeader}>
                  <Tri size={10} color={active ? colors.blue : colors.line} />
                  <Text style={[styles.tplEn, active && { color: colors.blueDeep }]}>{t.labelEn}</Text>
                  <Text style={styles.tplJp}>{t.labelJp}</Text>
                  <Text style={styles.tplCount}>{t.items.length}項目</Text>
                </View>
                <Text style={styles.tplDesc}>{t.description}</Text>
                <Text style={styles.tplSample} numberOfLines={1}>
                  例: {t.items[0].text}
                </Text>
              </Card>
            </Pressable>
          );
        })}

        <PrimaryButton
          title="NEXT / この心得ではじめる"
          onPress={() =>
            router.push({ pathname: '/(onboarding)/notification-setup', params: { template: selected } })
          }
          style={{ marginTop: 12 }}
        />
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
    padding: spacing.screenX,
    paddingBottom: 48,
  },
  lead: {
    fontFamily: fonts.jp,
    fontSize: 13,
    lineHeight: 22,
    color: colors.inkSoft,
    marginBottom: 16,
  },
  tpl: {
    marginBottom: 12,
    gap: 6,
  },
  tplActive: {
    borderColor: colors.blue,
    borderWidth: 1.5,
  },
  tplHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tplEn: {
    ...enLabel,
    fontSize: 13,
    color: colors.inkSoft,
  },
  tplJp: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.mist,
  },
  tplCount: {
    marginLeft: 'auto',
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  tplDesc: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 19,
    color: colors.inkSoft,
  },
  tplSample: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
});
