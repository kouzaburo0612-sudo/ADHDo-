import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tri } from '../../components/tri';
import { PrimaryButton } from '../../components/ui';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

const PAGES = [
  {
    en: 'BYME',
    title: '人生は、自分の手で創る。',
    body: 'BYMEは目標を「見る」アプリではない。\n「唱える」アプリだ。',
  },
  {
    en: 'MORNING RITUAL',
    title: '毎朝、3つの儀式。',
    body: '宣言 — なりたい自分を声に出す。\n心得 — 今日の指針を1つだけ受け取る。\n日記 — 感謝と前進を3行で刻む。',
  },
  {
    en: 'BE, NOT WISH',
    title: '「なりたい」ではなく、\n「もうなっている」。',
    body: '宣言は必ず現在進行形で唱える。\n脳は繰り返された言葉を現実として受け入れる。\nこれは誰にも見せない、あなただけの儀式。',
  },
] as const;

export default function Welcome() {
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const p = PAGES[page];

  return (
    <SafeAreaView style={styles.root}>
      <Pressable
        style={styles.body}
        onPress={() => {
          if (!last) setPage(page + 1);
        }}
      >
        <Tri size={22} color={colors.blue} />
        <Text style={styles.en}>{p.en}</Text>
        <Text style={styles.title}>{p.title}</Text>
        <Text style={styles.text}>{p.body}</Text>
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <Tri key={i} size={8} color={i <= page ? colors.blue : colors.line} />
          ))}
        </View>
        {last ? (
          <PrimaryButton title="START / はじめる" onPress={() => router.push('/(onboarding)/identity-mvv')} />
        ) : (
          <PrimaryButton title="NEXT / つぎへ" onPress={() => setPage(page + 1)} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 18,
  },
  en: {
    ...enLabel,
    fontSize: 14,
    color: colors.blue,
  },
  title: {
    fontFamily: fonts.jpBlack,
    fontSize: 26,
    lineHeight: 40,
    color: colors.ink,
  },
  text: {
    fontFamily: fonts.jp,
    fontSize: 15,
    lineHeight: 28,
    color: colors.inkSoft,
  },
  footer: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 16,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
});
