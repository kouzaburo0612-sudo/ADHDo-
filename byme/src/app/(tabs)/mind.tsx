import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Field, GhostButton, PrimaryButton, SectionLabel } from '../../components/ui';
import type { Principle } from '../../db/types';
import { todaysPrinciple, useAppStore } from '../../store/useAppStore';
import { colors, fonts, spacing } from '../../theme/tokens';

export default function Mind() {
  const principles = useAppStore((s) => s.principles);
  const addPrinciple = useAppStore((s) => s.addPrinciple);
  const editPrinciple = useAppStore((s) => s.editPrinciple);
  const togglePrinciple = useAppStore((s) => s.togglePrinciple);
  const removePrinciple = useAppStore((s) => s.removePrinciple);

  const today = todaysPrinciple(principles);

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState('');

  const startEdit = (p: Principle) => {
    setEditingId(p.id);
    setText(p.text);
    setSource(p.source ?? '');
  };

  const save = async () => {
    const payload = { text: text.trim(), source: source.trim() || null };
    if (!payload.text) return;
    if (editingId === 'new') {
      await addPrinciple(payload);
    } else if (typeof editingId === 'number') {
      await editPrinciple(editingId, payload);
    }
    setEditingId(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SectionLabel en="MIND" jp="心得" />
          <Text style={styles.lead}>
            1日1心得。アクティブな心得が毎朝ローテーションで届く。
          </Text>

          {editingId === 'new' ? (
            <Card style={{ gap: 8, marginBottom: 14 }}>
              <Field multiline value={text} onChangeText={setText} placeholder="心得(例: 迷ったら、顧客が喜ぶ方を選べ。)" autoFocus />
              <Field value={source} onChangeText={setSource} placeholder="出典(任意)" />
              <View style={styles.actions}>
                <GhostButton title="やめる" onPress={() => setEditingId(null)} style={{ flex: 1 }} />
                <PrimaryButton title="追加" onPress={save} style={{ flex: 1 }} />
              </View>
            </Card>
          ) : (
            <PrimaryButton title="＋ 心得を追加" onPress={() => { setEditingId('new'); setText(''); setSource(''); }} style={{ marginBottom: 14 }} />
          )}

          {principles.map((p) => {
            const isToday = today?.id === p.id;
            if (editingId === p.id) {
              return (
                <Card key={p.id} style={{ gap: 8, marginBottom: 10 }}>
                  <Field multiline value={text} onChangeText={setText} autoFocus />
                  <Field value={source} onChangeText={setSource} placeholder="出典(任意)" />
                  <View style={styles.actions}>
                    <GhostButton
                      title="削除"
                      onPress={async () => {
                        await removePrinciple(p.id);
                        setEditingId(null);
                      }}
                      style={{ flex: 1 }}
                    />
                    <PrimaryButton title="保存" onPress={save} style={{ flex: 1 }} />
                  </View>
                </Card>
              );
            }
            return (
              <Card
                key={p.id}
                style={[styles.row, isToday && styles.rowToday, p.active === 0 && { opacity: 0.5 }]}
              >
                <Pressable style={{ flex: 1 }} onPress={() => startEdit(p)}>
                  <Text style={styles.rowText}>{p.text}</Text>
                  <View style={styles.rowMetaLine}>
                    {p.source ? <Text style={styles.rowMeta}>— {p.source}</Text> : null}
                    {isToday ? <Text style={styles.todayBadge}>TODAY</Text> : null}
                  </View>
                </Pressable>
                <Switch
                  value={p.active === 1}
                  onValueChange={(v) => togglePrinciple(p.id, v)}
                  trackColor={{ true: colors.blue, false: colors.line }}
                />
              </Card>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 40,
  },
  lead: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  rowToday: {
    borderColor: colors.blue,
    borderWidth: 1.5,
  },
  rowText: {
    fontFamily: fonts.jpMedium,
    fontSize: 14,
    lineHeight: 23,
    color: colors.ink,
  },
  rowMetaLine: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
    alignItems: 'center',
  },
  rowMeta: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
  },
  todayBadge: {
    fontFamily: fonts.enSemi,
    letterSpacing: 1.5,
    fontSize: 9,
    color: colors.blueDeep,
    backgroundColor: colors.bluePale,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
