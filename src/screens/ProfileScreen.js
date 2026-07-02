import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, ScrollView, StyleSheet } from 'react-native';
import { T } from '../theme';
import { load, save } from '../store';

const GREEN = '#0da06f';

function SettingRow({ label, value, onChange, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: T.surface2, true: GREEN }}
        thumbColor="#fff"
      />
    </View>
  );
}

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [settings, setSettings] = useState({ notify: true, sound: true, autoscroll: true });

  useEffect(() => {
    load('name', '').then(setName);
    load('settings', { notify: true, sound: true, autoscroll: true }).then(setSettings);
  }, []);

  const setSetting = (key, v) => {
    const next = { ...settings, [key]: v };
    setSettings(next);
    save('settings', next);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.h1}>プロフィール & 設定</Text>
      </View>

      <View style={[styles.panel, { alignItems: 'center' }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(name || 'A')[0]}</Text>
        </View>
        <TextInput
          style={styles.nameInput}
          placeholder="名前"
          placeholderTextColor={T.ink3}
          value={name}
          onChangeText={(v) => { setName(v); save('name', v); }}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>設定</Text>
        <SettingRow label="リマインダー通知" value={settings.notify} onChange={(v) => setSetting('notify', v)} />
        <SettingRow label="サウンド" value={settings.sound} onChange={(v) => setSetting('sound', v)} />
        <SettingRow label="NOWへ自動スクロール" value={settings.autoscroll} onChange={(v) => setSetting('autoscroll', v)} last />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>1日の基本設定</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>起床時間</Text>
          <Text style={styles.rowValue}>06:30</Text>
        </View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowLabel}>就寝時間</Text>
          <Text style={styles.rowValue}>23:00</Text>
        </View>
      </View>

      <Text style={styles.version}>ADHDo v0.2</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  h1: { fontSize: 20, fontWeight: '700', color: T.ink },
  panel: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, padding: 18, marginHorizontal: 16, marginBottom: 14 },
  panelTitle: { fontSize: 15, fontWeight: '700', color: T.ink, marginBottom: 4 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, marginBottom: 10,
    backgroundColor: '#4a8df8', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  nameInput: {
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink,
    textAlign: 'center', width: 220,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line },
  rowLabel: { fontSize: 14, color: T.ink },
  rowValue: { fontSize: 14, color: T.ink2, fontVariant: ['tabular-nums'] },
  version: { textAlign: 'center', fontSize: 11, color: T.ink3, marginTop: 6 },
});
