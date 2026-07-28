import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ContentItem, ContentType, NumberExtra, PrincipleExtra } from '../../db/types';
import { parseExtra, parseModes } from '../../db/types';
import { useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

/** MASTERカテゴリ一覧: 並べ替え・有効/無効・アーカイブ済みの確認 */

const TYPE_TITLES: Record<string, string> = {
  AFFIRMATION: 'AFFIRMATIONS',
  IMAGING: 'IMAGING',
  GOAL: 'GOALS',
  NUMBER: 'NUMBERS',
  PRINCIPLE: 'PRINCIPLES',
  OPTIONAL: 'OPTIONAL / OTHER',
};

export default function MasterType() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type = (params.type ?? 'AFFIRMATION') as ContentType;

  const items = useAppStore((s) => s.items);
  const editItem = useAppStore((s) => s.editItem);
  const moveItem = useAppStore((s) => s.moveItem);
  const restore = useAppStore((s) => s.restore);
  const [showArchived, setShowArchived] = useState(false);

  const list = useMemo(
    () =>
      items
        .filter((i) => i.type === type && i.archived_at === null)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [items, type]
  );
  const archived = useMemo(
    () => items.filter((i) => i.type === type && i.archived_at !== null),
    [items, type]
  );

  const modeBadge = (i: ContentItem) => {
    const m = parseModes(i);
    if (m.length === 0) return '儀式外';
    return m.map((x) => x[0].toUpperCase()).join('/');
  };

  const subtitle = (i: ContentItem): string => {
    if (i.type === 'NUMBER') {
      const ex = parseExtra<NumberExtra>(i);
      const img = ex.imagingTarget !== null && ex.imagingTarget !== undefined ? ` / 唱:${ex.imagingTarget}${ex.unit}` : '';
      return `目標 ${ex.officialTarget}${ex.unit} / 現在 ${ex.currentValue}${ex.unit}${img}`;
    }
    if (i.type === 'PRINCIPLE') {
      const ex = parseExtra<PrincipleExtra>(i);
      return `${ex.role === 'ROTATING' ? 'ROTATING' : 'CORE'}${ex.category ? ' — ' + ex.category : ''}`;
    }
    return '';
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.back}>‹ MASTER</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/master/item/[id]', params: { id: 'new', type } })}
        >
          <Text style={styles.add}>+ 追加</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{TYPE_TITLES[type] ?? type}</Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? <Text style={styles.empty}>まだ項目がありません。「+ 追加」から。</Text> : null}
        {list.map((i, idx) => (
          <View key={i.id} style={styles.row}>
            <View style={styles.orderCol}>
              <Pressable
                disabled={idx === 0}
                onPress={() => moveItem(i.id, -1)}
                hitSlop={6}
                accessibilityLabel="上へ"
              >
                <Text style={[styles.orderBtn, idx === 0 && styles.orderBtnOff]}>▲</Text>
              </Pressable>
              <Pressable
                disabled={idx === list.length - 1}
                onPress={() => moveItem(i.id, 1)}
                hitSlop={6}
                accessibilityLabel="下へ"
              >
                <Text style={[styles.orderBtn, idx === list.length - 1 && styles.orderBtnOff]}>▼</Text>
              </Pressable>
            </View>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/master/item/[id]', params: { id: String(i.id) } })}
              accessibilityRole="button"
            >
              <Text style={[styles.body, i.is_active === 0 && styles.bodyOff]} numberOfLines={2}>
                {i.title ? `${i.title} — ` : ''}
                {i.body}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{'★'.repeat(i.priority)}</Text>
                <Text style={styles.meta}>{modeBadge(i)}</Text>
                {i.emphasis === 1 ? <Text style={[styles.meta, { color: colors.blue }]}>重点反復</Text> : null}
                {subtitle(i) ? <Text style={styles.meta}>{subtitle(i)}</Text> : null}
                {i.duplicate_status === 'candidate' ? (
                  <Text style={[styles.meta, { color: colors.red }]}>重複候補</Text>
                ) : null}
              </View>
            </Pressable>
            <Switch
              value={i.is_active === 1}
              onValueChange={(v) => editItem(i.id, { is_active: v ? 1 : 0 })}
              trackColor={{ true: colors.blue, false: colors.line }}
              accessibilityLabel="有効"
            />
          </View>
        ))}

        {archived.length > 0 ? (
          <View style={{ marginTop: 24 }}>
            <Pressable onPress={() => setShowArchived(!showArchived)} accessibilityRole="button">
              <Text style={styles.archToggle}>
                {showArchived ? '▾' : '▸'} アーカイブ {archived.length}件(削除はされていません)
              </Text>
            </Pressable>
            {showArchived
              ? archived.map((i) => (
                  <View key={i.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.body, styles.bodyOff]} numberOfLines={2}>
                        {i.title ? `${i.title} — ` : ''}
                        {i.body}
                      </Text>
                      {i.duplicate_status === 'merged' ? (
                        <Text style={styles.meta}>統合済み(復元可能)</Text>
                      ) : null}
                    </View>
                    <Pressable onPress={() => restore(i.id)} accessibilityRole="button" hitSlop={8}>
                      <Text style={styles.restore}>復元</Text>
                    </Pressable>
                  </View>
                ))
              : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
  },
  back: {
    fontFamily: fonts.jpMedium,
    fontSize: 14,
    color: colors.blue,
  },
  add: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    color: colors.blue,
  },
  title: {
    ...enLabel,
    fontSize: 18,
    color: colors.ink,
    paddingHorizontal: spacing.screenX,
    marginTop: 12,
    marginBottom: 4,
  },
  scroll: {
    padding: spacing.screenX,
    paddingTop: 8,
    paddingBottom: 48,
  },
  empty: {
    fontFamily: fonts.jp,
    fontSize: 13,
    color: colors.mist,
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  orderCol: {
    gap: 8,
  },
  orderBtn: {
    fontSize: 11,
    color: colors.mist,
  },
  orderBtnOff: {
    color: colors.line,
  },
  body: {
    fontFamily: fonts.jp,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.ink,
  },
  bodyOff: {
    color: colors.mist,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  meta: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
  },
  archToggle: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.mist,
    paddingVertical: 6,
  },
  restore: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.blue,
  },
});
