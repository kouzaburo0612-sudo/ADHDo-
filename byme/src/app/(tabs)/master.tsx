import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field } from '../../components/ui';
import type { ContentItem, ContentType } from '../../db/types';
import { CONTENT_TYPES } from '../../db/types';
import { useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

/** MASTER: すべての内容の正本。一覧・検索・重複整理の入口 */

const TYPE_META: Record<ContentType, { en: string; jp: string }> = {
  AFFIRMATION: { en: 'AFFIRMATIONS', jp: 'アファメーション' },
  IMAGING: { en: 'IMAGING', jp: '成功後のイメージング' },
  GOAL: { en: 'GOALS', jp: '短期・中期・長期目標' },
  NUMBER: { en: 'NUMBERS', jp: '目標数字' },
  PRINCIPLE: { en: 'PRINCIPLES', jp: '成功法則・戒め' },
  OPTIONAL: { en: 'OPTIONAL / OTHER', jp: 'BODY・睡眠・クエストなど' },
};

export default function Master() {
  const items = useAppStore((s) => s.items);
  const merge = useAppStore((s) => s.merge);
  const markIndependent = useAppStore((s) => s.markIndependent);
  const [query, setQuery] = useState('');

  const active = useMemo(() => items.filter((i) => i.archived_at === null), [items]);

  const results = useMemo(() => {
    const qq = query.trim().toLowerCase();
    if (!qq) return [];
    return active
      .filter((i) => `${i.title}${i.body}`.toLowerCase().includes(qq))
      .slice(0, 30);
  }, [active, query]);

  const candidates = useMemo(
    () => active.filter((i) => i.duplicate_status === 'candidate' && i.canonical_item_id !== null),
    [active]
  );

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const resolveCandidate = (item: ContentItem) => {
    const canonical = byId.get(item.canonical_item_id ?? -1);
    if (!canonical) return;
    Alert.alert(
      '似た内容がすでにあります',
      `正本:\n${canonical.title ? canonical.title + '\n' : ''}${canonical.body}\n\nこの項目:\n${item.title ? item.title + '\n' : ''}${item.body}`,
      [
        {
          text: '既存項目に統合',
          onPress: () => merge(canonical.id, item.id, '重複候補の手動統合'),
        },
        { text: '別項目として残す', onPress: () => markIndependent(item.id) },
        { text: '今回は無視', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>MASTER</Text>
        <Text style={styles.sub}>すべての内容の正本。ここで整理し、毎日はTODAYだけを見る。</Text>

        <Field
          placeholder="検索(全カテゴリ)"
          value={query}
          onChangeText={setQuery}
          style={{ marginBottom: 16 }}
          accessibilityLabel="検索"
        />

        {results.length > 0 ? (
          <View style={styles.block}>
            {results.map((i) => (
              <Pressable
                key={i.id}
                style={styles.resultRow}
                onPress={() => router.push({ pathname: '/master/item/[id]', params: { id: String(i.id) } })}
              >
                <Text style={styles.resultType}>{TYPE_META[i.type].en}</Text>
                <Text style={styles.resultText} numberOfLines={2}>
                  {i.title ? `${i.title} — ` : ''}
                  {i.body}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {candidates.length > 0 ? (
          <View style={styles.dupBlock}>
            <Text style={styles.dupTitle}>重複候補 {candidates.length}件</Text>
            <Text style={styles.dupSub}>自動では統合しません。確認して選んでください。</Text>
            {candidates.slice(0, 10).map((i) => (
              <Pressable key={i.id} style={styles.dupRow} onPress={() => resolveCandidate(i)}>
                <Text style={styles.resultText} numberOfLines={1}>
                  {i.title || i.body}
                </Text>
                <Text style={styles.dupAction}>確認 ▸</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {CONTENT_TYPES.map((t) => {
          const count = active.filter((i) => i.type === t).length;
          return (
            <Pressable
              key={t}
              accessibilityRole="button"
              style={styles.catRow}
              onPress={() => router.push({ pathname: '/master/[type]', params: { type: t } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.catEn}>{TYPE_META[t].en}</Text>
                <Text style={styles.catJp}>{TYPE_META[t].jp}</Text>
              </View>
              <Text style={styles.catCount}>{count}</Text>
              <Text style={styles.chev}>▸</Text>
            </Pressable>
          );
        })}
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
  title: {
    ...enLabel,
    fontSize: 20,
    color: colors.ink,
  },
  sub: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 20,
    color: colors.mist,
    marginTop: 6,
    marginBottom: 18,
  },
  block: {
    marginBottom: 18,
  },
  resultRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  resultType: {
    ...enLabel,
    fontSize: 10,
    color: colors.blue,
  },
  resultText: {
    fontFamily: fonts.jp,
    fontSize: 13,
    lineHeight: 21,
    color: colors.ink,
    marginTop: 2,
  },
  dupBlock: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    backgroundColor: colors.white,
  },
  dupTitle: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    color: colors.ink,
  },
  dupSub: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
    marginTop: 2,
    marginBottom: 8,
  },
  dupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  dupAction: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.blue,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  catEn: {
    ...enLabel,
    fontSize: 14,
    color: colors.ink,
  },
  catJp: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
    marginTop: 3,
  },
  catCount: {
    fontFamily: fonts.enSemi,
    fontSize: 16,
    color: colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  chev: {
    color: colors.mist,
    fontSize: 14,
  },
});
