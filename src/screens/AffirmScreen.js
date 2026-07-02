import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { T, rgba } from '../theme';
import { load, save } from '../store';

const PURPLE = '#9d7bf5';
const DEFAULTS = [
  '私は今、やるべきことに集中できる',
  '小さな一歩も、確かな前進だ',
  '完璧じゃなくていい。続けることが大事',
  '私の脳はユニークで、それは強みだ',
  '休むことも、前に進むための行動だ',
  '昨日の自分より、少しだけ良くなればいい',
];

export default function AffirmScreen() {
  const [custom, setCustom] = useState([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const all = [...DEFAULTS, ...custom];

  useEffect(() => { load('affirms', []).then(setCustom); }, []);

  const add = () => {
    const v = input.trim();
    if (!v) return;
    const list = [...custom, v];
    setCustom(list);
    save('affirms', list);
    setInput('');
    setIdx(DEFAULTS.length + list.length - 1);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.h1}>アファメーション</Text>
        <Text style={styles.sub}>自分に優しい言葉を</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.quote}>{all[idx % all.length]}</Text>
        <Text style={styles.count}>{(idx % all.length) + 1} / {all.length}</Text>
      </View>

      <TouchableOpacity style={styles.nextBtn} onPress={() => setIdx((i) => i + 1)}>
        <Text style={styles.nextBtnText}>次の言葉</Text>
      </TouchableOpacity>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>自分の言葉を追加</Text>
        <TextInput
          style={styles.input}
          placeholder="例:私は一歩ずつ進んでいる"
          placeholderTextColor={T.ink3}
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.addBtn} onPress={add}>
          <Text style={styles.addBtnText}>追加</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  h1: { fontSize: 20, fontWeight: '700', color: T.ink },
  sub: { fontSize: 13, color: T.ink2, marginTop: 2 },
  card: {
    backgroundColor: rgba(PURPLE, 0.16), borderWidth: 1, borderColor: rgba(PURPLE, 0.4),
    borderRadius: 18, paddingVertical: 44, paddingHorizontal: 24,
    marginHorizontal: 16, marginBottom: 14, alignItems: 'center',
    shadowColor: PURPLE, shadowOpacity: 0.2, shadowRadius: 16,
  },
  quote: { fontSize: 18, fontWeight: '700', color: T.ink, lineHeight: 30, textAlign: 'center' },
  count: { fontSize: 11, color: T.ink3, marginTop: 14 },
  nextBtn: { alignSelf: 'center', backgroundColor: '#4a8df8', borderRadius: 10, paddingHorizontal: 22, paddingVertical: 10, marginBottom: 16 },
  nextBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  panel: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, padding: 18, marginHorizontal: 16, marginBottom: 14 },
  panelTitle: { fontSize: 15, fontWeight: '700', color: T.ink, marginBottom: 10 },
  input: { backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line, borderRadius: 10, padding: 12, fontSize: 14, color: T.ink },
  addBtn: { alignSelf: 'flex-end', marginTop: 10, backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText: { fontSize: 13, fontWeight: '600', color: T.ink },
});
