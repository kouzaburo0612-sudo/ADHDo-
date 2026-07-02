import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { T } from '../theme';
import { fmt, nowMinutes } from '../data';
import { load, save } from '../store';

export default function DiaryScreen() {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState([]);
  const d = new Date();

  useEffect(() => { load('diary', []).then(setEntries); }, []);

  const saveEntry = () => {
    const t = text.trim();
    if (!t) return;
    const list = [{ date: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${fmt(nowMinutes())}`, text: t }, ...entries];
    setEntries(list);
    save('diary', list);
    setText('');
  };

  const remove = (i) => {
    const list = entries.filter((_, x) => x !== i);
    setEntries(list);
    save('diary', list);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.h1}>日記</Text>
        <Text style={styles.sub}>{d.getMonth() + 1}月{d.getDate()}日</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>今日のふりかえり</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={5}
          placeholder="今日できたこと、感じたことを自由に…"
          placeholderTextColor={T.ink3}
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={saveEntry}>
          <Text style={styles.saveBtnText}>保存する</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>これまでの記録</Text>
        {entries.length === 0 && <Text style={styles.empty}>まだ記録がありません</Text>}
        {entries.map((e, i) => (
          <View key={e.date + i} style={[styles.entry, i === entries.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.entryHead}>
              <Text style={styles.entryDate}>{e.date}</Text>
              <TouchableOpacity onPress={() => remove(i)}>
                <Text style={styles.entryDelete}>削除</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.entryText}>{e.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  h1: { fontSize: 20, fontWeight: '700', color: T.ink },
  sub: { fontSize: 13, color: T.ink2, marginTop: 2 },
  panel: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, padding: 18, marginHorizontal: 16, marginBottom: 14 },
  panelTitle: { fontSize: 15, fontWeight: '700', color: T.ink, marginBottom: 10 },
  input: {
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line, borderRadius: 10,
    padding: 12, fontSize: 14, color: T.ink, minHeight: 110, textAlignVertical: 'top',
  },
  saveBtn: { alignSelf: 'flex-end', marginTop: 10, backgroundColor: '#4a8df8', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  empty: { fontSize: 13, color: T.ink3 },
  entry: { borderBottomWidth: 1, borderBottomColor: T.line, paddingVertical: 12 },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
  entryDate: { fontSize: 11, color: T.ink3 },
  entryDelete: { fontSize: 11, color: T.ink3 },
  entryText: { fontSize: 13.5, color: T.ink, marginTop: 4, lineHeight: 20 },
});
