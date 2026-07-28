import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, GhostButton, PrimaryButton, SectionLabel } from '../../../components/ui';
import type {
  ContentItem,
  ContentType,
  GoalExtra,
  ImagingExtra,
  NumberExtra,
  PrincipleExtra,
  RitualMode,
} from '../../../db/types';
import { parseExtra, parseModes } from '../../../db/types';
import { useAppStore } from '../../../store/useAppStore';
import { colors, fonts, spacing } from '../../../theme/tokens';

/**
 * 項目エディタ。追加・編集の両方。
 * 保存時に類似チェックを行い「似た内容がすでにあります」を提示する(自動統合はしない)。
 */

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

type CadenceKind = 'daily' | 'weekly' | 'rotation';

export default function ItemEditor() {
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const isNew = params.id === 'new';
  const items = useAppStore((s) => s.items);
  const addItem = useAppStore((s) => s.addItem);
  const editItemAction = useAppStore((s) => s.editItem);
  const archive = useAppStore((s) => s.archive);
  const findSimilar = useAppStore((s) => s.findSimilar);
  const merge = useAppStore((s) => s.merge);

  const existing: ContentItem | null = useMemo(
    () => (isNew ? null : items.find((i) => i.id === Number(params.id)) ?? null),
    [isNew, items, params.id]
  );

  const type = (existing?.type ?? params.type ?? 'AFFIRMATION') as ContentType;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [priority, setPriority] = useState(existing?.priority ?? 2);
  const [emphasis, setEmphasis] = useState(existing?.emphasis === 1);
  const [modes, setModes] = useState<RitualMode[]>(
    existing ? parseModes(existing) : type === 'OPTIONAL' ? [] : ['standard', 'full']
  );

  const initCadence = existing?.cadence ?? (type === 'PRINCIPLE' ? 'rotation' : 'daily');
  const [cadenceKind, setCadenceKind] = useState<CadenceKind>(
    initCadence.startsWith('weekly') ? 'weekly' : initCadence === 'rotation' ? 'rotation' : 'daily'
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    initCadence.startsWith('weekly')
      ? initCadence.split(':')[1]?.split(',').map(Number) ?? []
      : [1, 3, 5]
  );

  // type固有
  const ex = existing ? parseExtra<Record<string, unknown>>(existing) : {};
  const nx = ex as Partial<NumberExtra>;
  const gx = ex as Partial<GoalExtra>;
  const ix = ex as Partial<ImagingExtra>;
  const px = ex as Partial<PrincipleExtra>;
  const [unit, setUnit] = useState(String(nx.unit ?? '億円'));
  const [official, setOfficial] = useState(String(nx.officialTarget ?? ''));
  const [current, setCurrent] = useState(String(nx.currentValue ?? '0'));
  const [imaging, setImaging] = useState(
    nx.imagingTarget !== null && nx.imagingTarget !== undefined ? String(nx.imagingTarget) : ''
  );
  const [targetYear, setTargetYear] = useState(gx.targetYear ? String(gx.targetYear) : '');
  const [horizon, setHorizon] = useState<GoalExtra['horizon']>(gx.horizon ?? 'SHORT');
  const [imageUrl, setImageUrl] = useState(String(ix.imageUrl ?? ''));
  const [role, setRole] = useState<PrincipleExtra['role']>(px.role === 'CORE' ? 'CORE' : 'ROTATING');
  const [category, setCategory] = useState(String(px.category ?? ''));

  const toggleMode = (m: RitualMode) => {
    setModes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const buildExtra = (): Record<string, unknown> => {
    const base = { ...ex };
    if (type === 'NUMBER') {
      return {
        ...base,
        unit,
        officialTarget: Number(official) || 0,
        currentValue: Number(current) || 0,
        imagingTarget: imaging.trim() === '' ? null : Number(imaging),
        targetYear: targetYear ? Number(targetYear) : undefined,
        lastUpdatedAt: new Date().toISOString(),
      };
    }
    if (type === 'GOAL') {
      return { ...base, horizon, targetYear: targetYear ? Number(targetYear) : undefined };
    }
    if (type === 'IMAGING') {
      return { ...base, imageUrl: imageUrl.trim() || undefined };
    }
    if (type === 'PRINCIPLE') {
      return { ...base, role, category: category.trim() || undefined };
    }
    return base;
  };

  const cadenceString = () =>
    cadenceKind === 'weekly' ? `weekly:${[...weekdays].sort().join(',')}` : cadenceKind;

  const doSave = async () => {
    const payload = {
      title: title.trim(),
      body: body.trim(),
      priority,
      cadence: cadenceString(),
      modes: modes.join(','),
      emphasis: emphasis ? 1 : 0,
      extra: buildExtra(),
    };
    if (existing) {
      await editItemAction(existing.id, payload);
    } else {
      await addItem({ type, ...payload });
    }
    router.back();
  };

  const save = async () => {
    if (body.trim() === '' && title.trim() === '') {
      Alert.alert('本文を入力してください');
      return;
    }
    // 類似チェック(ローカル。閾値以上で確認を出す。自動統合はしない)
    const matches = await findSimilar(type, `${title}${body}`, existing?.id);
    if (matches.length === 0) {
      await doSave();
      return;
    }
    const top = matches[0];
    Alert.alert(
      '似た内容がすでにあります',
      `${top.item.title ? top.item.title + '\n' : ''}${top.item.body}\n\n(類似度 ${(top.score * 100).toFixed(0)}%)`,
      [
        {
          text: '既存項目に統合',
          onPress: async () => {
            if (existing) {
              await merge(top.item.id, existing.id, `類似度${(top.score * 100).toFixed(0)}%の手動統合`);
            }
            // 新規の場合は保存せず既存を正とする
            router.back();
          },
        },
        {
          text: '新しい項目として残す',
          onPress: async () => {
            await doSave();
          },
        },
        { text: '今回は無視(保存)', onPress: doSave },
        { text: 'キャンセル', style: 'cancel' },
      ]
    );
  };

  const confirmArchive = () => {
    if (!existing) return;
    Alert.alert('アーカイブしますか?', '削除はされません。MASTERの一覧からいつでも復元できます。', [
      {
        text: 'アーカイブ',
        style: 'destructive',
        onPress: async () => {
          await archive(existing.id);
          router.back();
        },
      },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.title}>{isNew ? '追加' : '編集'} — {type}</Text>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Text style={styles.cancel}>閉じる</Text>
          </Pressable>
        </View>

        {type !== 'PRINCIPLE' ? (
          <Field placeholder="タイトル(任意)" value={title} onChangeText={setTitle} style={{ marginBottom: 10 }} />
        ) : null}
        <Field
          placeholder="本文"
          value={body}
          onChangeText={setBody}
          multiline
          style={{ marginBottom: 16 }}
        />

        {/* type固有フィールド */}
        {type === 'NUMBER' ? (
          <View style={styles.group}>
            <SectionLabel en="NUMBER" jp="公式目標と唱える数字は別管理" />
            <Row label="単位"><Field value={unit} onChangeText={setUnit} style={styles.small} /></Row>
            <Row label="正式目標"><Field value={official} onChangeText={setOfficial} keyboardType="decimal-pad" style={styles.small} /></Row>
            <Row label="現在値"><Field value={current} onChangeText={setCurrent} keyboardType="decimal-pad" style={styles.small} /></Row>
            <Row label="イメージング目標"><Field value={imaging} onChangeText={setImaging} keyboardType="decimal-pad" placeholder="なし" style={styles.small} /></Row>
            <Row label="対象年"><Field value={targetYear} onChangeText={setTargetYear} keyboardType="number-pad" style={styles.small} /></Row>
          </View>
        ) : null}

        {type === 'GOAL' ? (
          <View style={styles.group}>
            <SectionLabel en="HORIZON" jp="期間区分" />
            <View style={styles.segRow}>
              {(['SHORT', 'MID', 'LONG'] as const).map((h) => (
                <Pressable key={h} style={[styles.segBtn, horizon === h && styles.segOn]} onPress={() => setHorizon(h)}>
                  <Text style={[styles.segText, horizon === h && styles.segTextOn]}>{h}</Text>
                </Pressable>
              ))}
            </View>
            <Row label="目標年"><Field value={targetYear} onChangeText={setTargetYear} keyboardType="number-pad" style={styles.small} /></Row>
          </View>
        ) : null}

        {type === 'IMAGING' ? (
          <View style={styles.group}>
            <SectionLabel en="BACKGROUND" jp="背景画像(URL/ローカルURI。無ければグラデーション)" />
            <Field value={imageUrl} onChangeText={setImageUrl} placeholder="https://… または file://…" />
          </View>
        ) : null}

        {type === 'PRINCIPLE' ? (
          <View style={styles.group}>
            <SectionLabel en="ROLE" jp="COREは毎日必ず表示 / ROTATINGは日替わり" />
            <View style={styles.segRow}>
              {(['CORE', 'ROTATING'] as const).map((r) => (
                <Pressable key={r} style={[styles.segBtn, role === r && styles.segOn]} onPress={() => setRole(r)}>
                  <Text style={[styles.segText, role === r && styles.segTextOn]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Field value={category} onChangeText={setCategory} placeholder="カテゴリ(例: 成功法則)" style={{ marginTop: 10 }} />
          </View>
        ) : null}

        {/* 共通: 重要度・頻度・儀式モード */}
        <View style={styles.group}>
          <SectionLabel en="PRIORITY" jp="重要度" />
          <View style={styles.segRow}>
            {[1, 2, 3].map((p) => (
              <Pressable key={p} style={[styles.segBtn, priority === p && styles.segOn]} onPress={() => setPriority(p)}>
                <Text style={[styles.segText, priority === p && styles.segTextOn]}>{'★'.repeat(p)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <SectionLabel en="CADENCE" jp="表示頻度" />
          <View style={styles.segRow}>
            {(
              [
                ['daily', '毎日'],
                ['weekly', '曜日指定'],
                ['rotation', 'ローテ'],
              ] as [CadenceKind, string][]
            ).map(([k, label]) => (
              <Pressable key={k} style={[styles.segBtn, cadenceKind === k && styles.segOn]} onPress={() => setCadenceKind(k)}>
                <Text style={[styles.segText, cadenceKind === k && styles.segTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {cadenceKind === 'weekly' ? (
            <View style={[styles.segRow, { marginTop: 10 }]}>
              {WEEKDAY_LABELS.map((w, d) => (
                <Pressable
                  key={d}
                  style={[styles.dayBtn, weekdays.includes(d) && styles.segOn]}
                  onPress={() =>
                    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
                  }
                >
                  <Text style={[styles.segText, weekdays.includes(d) && styles.segTextOn]}>{w}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.group}>
          <SectionLabel en="RITUAL MODES" jp="どの儀式に含めるか" />
          <View style={styles.segRow}>
            {(['quick', 'standard', 'full'] as RitualMode[]).map((m) => (
              <Pressable key={m} style={[styles.segBtn, modes.includes(m) && styles.segOn]} onPress={() => toggleMode(m)}>
                <Text style={[styles.segText, modes.includes(m) && styles.segTextOn]}>{m.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>重点反復(ローテーションで優先)</Text>
            <Switch value={emphasis} onValueChange={setEmphasis} trackColor={{ true: colors.blue, false: colors.line }} />
          </View>
        </View>

        <PrimaryButton title={isNew ? '追加する' : '保存する'} onPress={save} style={{ marginTop: 8 }} />
        {existing ? (
          <GhostButton title="アーカイブ(削除しない)" onPress={confirmArchive} style={{ marginTop: 10 }} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    padding: spacing.screenX,
    paddingBottom: 60,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.jpBold,
    fontSize: 16,
    color: colors.ink,
  },
  cancel: {
    fontFamily: fonts.jp,
    fontSize: 13,
    color: colors.mist,
  },
  group: {
    marginBottom: 18,
  },
  segRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  dayBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  segOn: {
    borderColor: colors.blue,
    backgroundColor: colors.bluePale,
  },
  segText: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.inkSoft,
  },
  segTextOn: {
    color: colors.blueDeep,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  switchLabel: {
    fontFamily: fonts.jp,
    fontSize: 13,
    color: colors.inkSoft,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  fieldLabel: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.inkSoft,
    width: 110,
  },
  small: {
    paddingVertical: 8,
  },
});
