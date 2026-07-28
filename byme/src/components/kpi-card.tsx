import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Kpi } from '../db/types';
import { daysUntil } from '../lib/dates';
import { colors, enLabel, fonts } from '../theme/tokens';

/**
 * KPIカード(仕様6.2・最重要)。
 * 進捗バー・ペース計算はコミット値基準。ストレッチは「唱える数字」として併記。
 * linked_condition がある指標は青の連動バッジを表示し、未達の赤色表現にしない。
 */
export function KpiCard({
  kpi,
  onUpdate,
}: {
  kpi: Kpi;
  onUpdate: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const days = Math.max(0, daysUntil(kpi.deadline));
  const pct = kpi.commit_value > 0 ? Math.min(100, Math.round((kpi.current_value / kpi.commit_value) * 100)) : 0;
  const remaining = Math.max(0, kpi.commit_value - kpi.current_value);
  const months = Math.max(0.1, days / 30.4);
  const monthlyPace = (remaining / months).toFixed(1);
  const linked = kpi.linked_condition !== null;
  const unitShort = kpi.unit.replace('円', '');

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.label}>{kpi.label}</Text>
        <Text style={styles.days}>残り {days} 日</Text>
      </View>

      <Pressable
        onPress={() => {
          setDraft(String(kpi.current_value));
          setEditing(!editing);
        }}
      >
        <View style={styles.nums}>
          <Text style={styles.current}>{kpi.current_value}</Text>
          <Text style={styles.target}>
            / {kpi.commit_value} {kpi.unit}({pct}%)
          </Text>
        </View>
      </Pressable>

      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>

      <View style={styles.foot}>
        {linked ? (
          <View style={styles.linkedBadge}>
            <Text style={styles.linkedText}>{kpi.linked_condition}</Text>
          </View>
        ) : (
          <Text style={styles.pace}>
            達成には <Text style={styles.paceStrong}>月{monthlyPace}{unitShort}ペース</Text> が必要
          </Text>
        )}
        <Pressable
          hitSlop={8}
          onPress={() => {
            setDraft(String(kpi.current_value));
            setEditing(!editing);
          }}
        >
          <Text style={styles.edit}>{editing ? 'CLOSE' : 'UPDATE ✎'}</Text>
        </Pressable>
      </View>

      {kpi.stretch_value !== null ? (
        <Text style={styles.stretch}>
          唱える数字: {kpi.stretch_value}
          {kpi.unit}
        </Text>
      ) : null}

      {editing ? (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            inputMode="decimal"
            value={draft}
            onChangeText={setDraft}
            autoFocus
            placeholderTextColor={colors.mist}
          />
          <Pressable
            style={styles.saveBtn}
            onPress={() => {
              const v = parseFloat(draft);
              onUpdate(Number.isFinite(v) ? v : 0);
              setEditing(false);
            }}
          >
            <Text style={styles.saveText}>保存</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontFamily: fonts.jpBold,
    fontSize: 13,
    color: colors.inkSoft,
  },
  days: {
    fontFamily: fonts.enSemi,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.red,
  },
  nums: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  current: {
    fontFamily: fonts.enSemi,
    fontSize: 34,
    lineHeight: 36,
    color: colors.ink,
  },
  target: {
    fontFamily: fonts.en,
    fontSize: 15,
    color: colors.mist,
  },
  bar: {
    height: 6,
    backgroundColor: colors.bluePale,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.blue,
    borderRadius: 3,
  },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  pace: {
    flex: 1,
    fontFamily: fonts.jpMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  paceStrong: {
    color: colors.red,
    fontFamily: fonts.jpBold,
  },
  linkedBadge: {
    backgroundColor: colors.bluePale,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  linkedText: {
    fontFamily: fonts.jpMedium,
    fontSize: 10,
    color: colors.blueDeep,
  },
  edit: {
    ...enLabel,
    fontSize: 10,
    color: colors.mist,
  },
  stretch: {
    fontFamily: fonts.jpMedium,
    fontSize: 11,
    color: colors.blueDeep,
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.en,
    fontSize: 16,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  saveBtn: {
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontFamily: fonts.jpBold,
    fontSize: 13,
    color: colors.white,
  },
});
