import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, StyleSheet } from 'react-native';
import { T, rgba } from '../theme';

const GREEN = '#0da06f';
const PHASES = [
  { label: '吸って…', ms: 4000, scale: 1.25 },
  { label: '止めて', ms: 4000, scale: null },
  { label: '吐いて…', ms: 8000, scale: 0.85 },
];
const PRESETS = [1, 3, 5, 10];
const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function MeditateScreen() {
  const [total, setTotal] = useState(180);
  const [left, setLeft] = useState(180);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState('準備OK');
  const scale = useRef(new Animated.Value(1)).current;
  const breathTimer = useRef(null);
  const tickTimer = useRef(null);
  const phaseIdx = useRef(0);

  const stopAll = () => {
    clearTimeout(breathTimer.current);
    clearInterval(tickTimer.current);
    scale.stopAnimation();
  };

  const breatheStep = () => {
    const p = PHASES[phaseIdx.current % 3];
    setLabel(p.label);
    if (p.scale != null) {
      Animated.timing(scale, { toValue: p.scale, duration: p.ms, useNativeDriver: true }).start();
    }
    phaseIdx.current++;
    breathTimer.current = setTimeout(breatheStep, p.ms);
  };

  const start = () => {
    if (running) {
      stopAll();
      setRunning(false);
      setLabel('一時停止中');
      return;
    }
    setRunning(true);
    breatheStep();
    tickTimer.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          stopAll();
          setRunning(false);
          setLabel('おつかれさま 🌿');
          Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }).start();
          return total;
        }
        return l - 1;
      });
    }, 1000);
  };

  const reset = () => {
    stopAll();
    setRunning(false);
    setLeft(total);
    setLabel('準備OK');
    phaseIdx.current = 0;
    Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  useEffect(() => stopAll, []);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <Text style={styles.h1}>瞑想</Text>
        <Text style={styles.sub}>呼吸に意識を向けましょう</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.stage}>
          <Animated.View style={[styles.circle, { transform: [{ scale }] }]}>
            <Text style={styles.circleLabel}>{label}</Text>
          </Animated.View>
          <Text style={styles.timer}>{fmtSec(left)}</Text>
          <View style={styles.presets}>
            {PRESETS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.btn, total === m * 60 && styles.btnSel]}
                onPress={() => { reset(); setTotal(m * 60); setLeft(m * 60); }}
              >
                <Text style={[styles.btnText, total === m * 60 && { color: GREEN }]}>{m}分</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={start}>
              <Text style={[styles.btnText, { color: '#fff' }]}>{running ? '一時停止' : left < total ? '再開' : '開始'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={reset}>
              <Text style={styles.btnText}>リセット</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>やり方</Text>
        <Text style={styles.body}>
          円が大きくなったら4秒かけて吸い、4秒止めて、8秒かけてゆっくり吐きます。考えごとが浮かんでも大丈夫。気づいたら呼吸に戻るだけでOK。
        </Text>
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
  body: { fontSize: 13, color: T.ink2, lineHeight: 20 },
  stage: { alignItems: 'center', paddingVertical: 20 },
  circle: {
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: rgba(GREEN, 0.22), borderWidth: 2, borderColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: GREEN, shadowOpacity: 0.4, shadowRadius: 24,
  },
  circleLabel: { fontSize: 16, fontWeight: '700', color: T.ink },
  timer: { fontSize: 30, fontWeight: '800', color: T.ink, marginTop: 18, marginBottom: 6, fontVariant: ['tabular-nums'] },
  presets: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  btn: { backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnSel: { borderColor: GREEN },
  btnPrimary: { backgroundColor: '#4a8df8', borderColor: '#4a8df8' },
  btnText: { fontSize: 13, fontWeight: '600', color: T.ink },
});
