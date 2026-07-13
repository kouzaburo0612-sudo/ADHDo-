/** 目標設定モーダル(カロミル風)。トレンドタブとMoreタブの両方から使う */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, SectionTitle, Segmented } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { addDays, formatKeyJa, fromKey, toKey, todayKey } from '@/lib/dates';
import type { GoalPlan } from '@/lib/store';
import type { GoalNumbers } from '@/utils/deficit';

export function GoalEditModal({ visible, goal, onClose, onSave }: {
  visible: boolean;
  goal: GoalNumbers | null;
  onClose: () => void;
  onSave: (plan: GoalPlan) => void;
}) {
  const plan = goal?.plan;
  const [priority, setPriority] = useState<'body_fat' | 'weight'>('body_fat');
  const [bodyFat, setBodyFat] = useState('');
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [intakeMode, setIntakeMode] = useState<'auto' | 'custom'>('auto');
  const [customKcal, setCustomKcal] = useState('');
  const [p, setP] = useState('30');
  const [f, setF] = useState('25');
  const [c, setC] = useState('45');
  const [initialized, setInitialized] = useState(false);

  // モーダルを開くたびに現在の設定値を反映
  if (visible && !initialized && goal) {
    setPriority(plan?.priority ?? 'body_fat');
    setBodyFat(plan?.targetBodyFatPct != null ? String(plan.targetBodyFatPct) : '');
    setWeight(plan?.targetWeightKg != null ? String(plan.targetWeightKg) : '');
    setDate(plan?.targetDate ? fromKey(plan.targetDate) : null);
    setIntakeMode(plan?.intakeMode ?? 'auto');
    setCustomKcal(plan?.customIntakeKcal != null ? String(plan.customIntakeKcal) : '');
    setP(String(plan?.pfc.p ?? 30));
    setF(String(plan?.pfc.f ?? 25));
    setC(String(plan?.pfc.c ?? 45));
    setInitialized(true);
  }
  if (!visible && initialized) setInitialized(false);

  const save = () => {
    const w = parseFloat(weight);
    const bf = parseFloat(bodyFat);
    const targetWeightKg = Number.isFinite(w) ? w : null;
    const targetBodyFatPct = Number.isFinite(bf) ? bf : null;
    const targetDate = date ? toKey(date) : null;
    const pn = parseInt(p, 10) || 30;
    const fn = parseInt(f, 10) || 25;
    const cn = parseInt(c, 10) || 45;
    const prev = goal?.plan;
    // 起点は初回設定時のみ記録する。目標を編集しても累積赤字はリセットしない
    // (以前はここでリセットしていたため「累積が累積にならない」バグになっていた)
    onSave({
      priority,
      targetBodyFatPct,
      targetWeightKg,
      targetDate,
      startWeightKg: prev?.startWeightKg ?? goal?.currentWeightKg ?? null,
      startDate: prev?.startDate ?? todayKey(),
      intakeMode,
      customIntakeKcal: parseFloat(customKcal) || null,
      pfc: { p: pn, f: fn, c: cn },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.modalRoot} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.modalHead}>
          <Pressable onPress={onClose} hitSlop={10}><Text style={styles.modalCancel}>キャンセル</Text></Pressable>
          <Text style={styles.modalTitle}>目標設定</Text>
          <Pressable onPress={save} hitSlop={10}><Text style={styles.modalSave}>保存</Text></Pressable>
        </View>

        <SectionTitle>重視する指標</SectionTitle>
        <Card>
          <Segmented
            options={[
              { value: 'body_fat', label: '体脂肪率(推奨)' },
              { value: 'weight', label: '体重' },
            ]}
            value={priority}
            onChange={setPriority}
          />
          <Text style={styles.modalHint}>
            筋肉を残して絞るなら体脂肪率がおすすめ。ペースと必要赤字はこの指標から計算されます
          </Text>
        </Card>

        <SectionTitle>目標体脂肪率</SectionTitle>
        <Card>
          <View style={styles.modalRow}>
            <TextInput
              style={styles.modalInput}
              value={bodyFat} onChangeText={setBodyFat}
              keyboardType="decimal-pad" placeholder="例: 13.5"
              placeholderTextColor={Colors.textFaint}
            />
            <Text style={styles.modalUnit}>%</Text>
          </View>
          {goal?.currentBodyFatPct != null && (
            <Text style={styles.modalHint}>現在 {goal.currentBodyFatPct.toFixed(1)}%</Text>
          )}
        </Card>

        <SectionTitle>目標体重(任意)</SectionTitle>
        <Card>
          <View style={styles.modalRow}>
            <TextInput
              style={styles.modalInput}
              value={weight} onChangeText={setWeight}
              keyboardType="decimal-pad" placeholder="例: 62.0"
              placeholderTextColor={Colors.textFaint}
            />
            <Text style={styles.modalUnit}>kg</Text>
          </View>
          {goal?.currentWeightKg != null && (
            <Text style={styles.modalHint}>現在 {goal.currentWeightKg.toFixed(1)}kg</Text>
          )}
        </Card>

        <SectionTitle>目標日</SectionTitle>
        <Card>
          <Pressable onPress={() => setPickerOpen((v) => !v)}>
            <Text style={styles.modalDateText}>
              {date ? formatKeyJa(toKey(date)) : 'タップして選択'}
            </Text>
          </Pressable>
          {pickerOpen && (
            <DateTimePicker
              value={date ?? addDays(new Date(), 60)}
              mode="date"
              display="inline"
              minimumDate={addDays(new Date(), 7)}
              themeVariant="dark"
              accentColor={Colors.accent}
              onChange={(event, dt) => {
                if (event.type === 'set' && dt) { setDate(dt); setPickerOpen(false); }
              }}
            />
          )}
        </Card>

        <SectionTitle>1日の摂取カロリー目標</SectionTitle>
        <Card>
          <Segmented
            options={[
              { value: 'auto', label: '自動(ペースから逆算)' },
              { value: 'custom', label: '手入力' },
            ]}
            value={intakeMode}
            onChange={setIntakeMode}
          />
          {intakeMode === 'custom' ? (
            <View style={[styles.modalRow, { marginTop: Spacing.md }]}>
              <TextInput
                style={styles.modalInput}
                value={customKcal} onChangeText={setCustomKcal}
                keyboardType="number-pad" placeholder="例: 2000"
                placeholderTextColor={Colors.textFaint}
              />
              <Text style={styles.modalUnit}>kcal</Text>
            </View>
          ) : (
            <Text style={styles.modalHint}>
              実績の消費カロリーから、目標日に間に合う摂取量を毎日自動計算します
              {goal?.targetIntakeKcal != null ? `(現在の計算値: ${goal.targetIntakeKcal.toLocaleString()}kcal)` : ''}
            </Text>
          )}
        </Card>

        <SectionTitle>PFCバランス(%)</SectionTitle>
        <Card>
          <View style={styles.pfcRow}>
            <PfcInput label="P たんぱく質" value={p} onChange={setP} />
            <PfcInput label="F 脂質" value={f} onChange={setF} />
            <PfcInput label="C 炭水化物" value={c} onChange={setC} />
          </View>
          {(parseInt(p, 10) || 0) + (parseInt(f, 10) || 0) + (parseInt(c, 10) || 0) !== 100 && (
            <Text style={[styles.modalHint, { color: Colors.warn }]}>合計が100%になっていません</Text>
          )}
        </Card>
      </ScrollView>
    </Modal>
  );
}

function PfcInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.pfcLabel}>{label}</Text>
      <TextInput
        style={styles.pfcInput}
        value={value} onChangeText={onChange}
        keyboardType="number-pad"
        placeholderTextColor={Colors.textFaint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: Colors.bg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  modalTitle: { color: Colors.text, fontSize: Type.body, fontWeight: '700' },
  modalCancel: { color: Colors.textSecondary, fontSize: Type.body },
  modalSave: { color: Colors.accent, fontSize: Type.body, fontWeight: '700' },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  modalInput: {
    flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 20, fontVariant: ['tabular-nums'],
  },
  modalUnit: { color: Colors.textSecondary, fontSize: Type.body },
  modalHint: { color: Colors.textFaint, fontSize: Type.caption, marginTop: Spacing.sm, lineHeight: 16 },
  modalDateText: { color: Colors.accent, fontSize: Type.body, fontWeight: '600', paddingVertical: 4 },
  pfcRow: { flexDirection: 'row', gap: Spacing.sm },
  pfcLabel: { color: Colors.textSecondary, fontSize: Type.caption, marginBottom: 4 },
  pfcInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, paddingHorizontal: 8, paddingVertical: 8, fontSize: Type.body,
    fontVariant: ['tabular-nums'], textAlign: 'center',
  },
});
