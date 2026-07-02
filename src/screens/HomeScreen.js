import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Clock24 from '../components/Clock24';
import { T, rgba } from '../theme';
import { CATS, SCHEDULE, fmt, dur, isActive, isPast, durLabel, nowMinutes, WEEKDAYS } from '../data';

function Legend() {
  const totals = {};
  for (const e of SCHEDULE) totals[e.cat] = (totals[e.cat] || 0) + dur(e);
  return (
    <View style={styles.legend}>
      {Object.entries(CATS).map(([k, c]) => (
        <View key={k} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: c.hex }]} />
          <Text style={styles.legendText}>
            {c.name} <Text style={styles.legendHours}>{(totals[k] / 60).toFixed(totals[k] % 60 ? 1 : 0)}h</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function SubRow({ sub, event, now, catHex }) {
  const active = isActive(sub, now) && isActive(event, now);
  const done = !active && now >= sub.end && now >= event.start;
  return (
    <View style={[styles.sub, done && { opacity: 0.45 }]}>
      <View
        style={[
          styles.subDot,
          active && { backgroundColor: catHex, transform: [{ scale: 1.35 }], shadowColor: catHex, shadowOpacity: 0.9, shadowRadius: 4 },
        ]}
      />
      <Text style={[styles.subName, done && styles.subDone, active && { color: T.ink, fontWeight: '600' }]}>
        {sub.name}
      </Text>
      <Text style={[styles.subTime, active && { color: catHex }]}>
        {fmt(sub.start)} – {fmt(sub.end)}
      </Text>
    </View>
  );
}

function TimelineItem({ event, now, flash, onLayoutY }) {
  const cat = CATS[event.cat];
  const active = isActive(event, now);
  const past = !active && isPast(event, now);
  const elapsed = (now - event.start + 1440) % 1440;
  const pct = Math.min(100, Math.round((elapsed / dur(event)) * 100));
  const remain = dur(event) - elapsed;

  return (
    <View style={styles.tlItem} onLayout={(e) => onLayoutY(event.id, e.nativeEvent.layout.y)}>
      <Text style={[styles.tlTime, active && { fontSize: 17, color: cat.hex, fontWeight: '800' }, past && { opacity: 0.55 }]}>
        {fmt(event.start)}
      </Text>
      <View style={styles.tlLineCol}>
        <View style={styles.tlLine} />
        <View
          style={[
            styles.tlNode,
            { borderColor: cat.hex },
            active && { width: 14, height: 14, borderRadius: 7, backgroundColor: cat.hex, shadowColor: cat.hex, shadowOpacity: 0.9, shadowRadius: 8 },
          ]}
        />
      </View>
      <View
        style={[
          styles.card,
          { borderLeftColor: cat.hex },
          past && { opacity: 0.55 },
          active && {
            padding: 17,
            transform: [{ scale: 1.02 }],
            backgroundColor: rgba(cat.hex, 0.1),
            borderColor: rgba(cat.hex, 0.55),
            shadowColor: cat.hex,
            shadowOpacity: 0.35,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          },
          flash && { borderColor: cat.hex, borderWidth: 2 },
        ]}
      >
        <View style={styles.row1}>
          <Text style={[styles.title, active && { fontSize: 19 }]} numberOfLines={2}>
            {cat.icon} {event.title}
          </Text>
          {active ? (
            <View style={[styles.nowBadge, { backgroundColor: cat.hex }]}>
              <View style={styles.nowBadgeDot} />
              <Text style={styles.nowBadgeText}>NOW</Text>
            </View>
          ) : (
            <View style={[styles.catTag, { borderColor: rgba(cat.hex, 0.45) }]}>
              <Text style={[styles.catTagText, { color: cat.hex }]}>{cat.name}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.range, active && { color: T.ink, fontSize: 13 }]}>
          {fmt(event.start)} – {fmt(event.end)} ・ {durLabel(dur(event))}
        </Text>

        {event.subs && (
          <View style={styles.subs}>
            {event.subs.map((s) => (
              <SubRow key={s.name + s.start} sub={s} event={event} now={now} catHex={cat.hex} />
            ))}
          </View>
        )}

        {active && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: cat.hex }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressText}>{pct}% 経過</Text>
              <Text style={styles.progressText}>あと {durLabel(remain)}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [now, setNow] = useState(nowMinutes());
  const [tip, setTip] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const scrollRef = useRef(null);
  const positions = useRef({});
  const tlOffset = useRef(0);
  const didAutoScroll = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30000);
    return () => clearInterval(t);
  }, []);

  const scrollToEvent = (id, flash) => {
    const y = positions.current[id];
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, tlOffset.current + y - 180), animated: true });
      if (flash) {
        setFlashId(id);
        setTimeout(() => setFlashId(null), 1600);
      }
    }
  };

  const onLayoutY = (id, y) => {
    positions.current[id] = y;
    // レイアウト確定後に一度だけNOWへ自動スクロール
    const cur = SCHEDULE.find((e) => isActive(e, now));
    if (!didAutoScroll.current && cur && positions.current[cur.id] != null) {
      didAutoScroll.current = true;
      setTimeout(() => scrollToEvent(cur.id, false), 350);
    }
  };

  const onSelect = (id) => {
    const e = SCHEDULE.find((x) => x.id === id);
    if (!e) return;
    setTip(e);
    scrollToEvent(id, true);
    setTimeout(() => setTip((t) => (t === e ? null : t)), 3000);
  };

  const d = new Date();
  const cur = SCHEDULE.find((e) => isActive(e, now));
  const remain = cur ? dur(cur) - ((now - cur.start + 1440) % 1440) : 0;

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <Text style={styles.h1}>今日のスケジュール</Text>
        <Text style={styles.date}>
          {d.getFullYear()}年{d.getMonth() + 1}月{d.getDate()}日 ({WEEKDAYS[d.getDay()]})
        </Text>
      </View>

      <View style={styles.clockWrap}>
        <Clock24 now={now} onSelect={onSelect} />
        <View style={styles.clockCenter} pointerEvents="none">
          <Text style={styles.ccDay}>
            {d.getMonth() + 1}/{d.getDate()} {WEEKDAYS[d.getDay()]}曜日
          </Text>
          <Text style={styles.ccTime}>{fmt(now)}</Text>
          {cur && (
            <>
              <View style={styles.ccChip}>
                <View style={[styles.ccDot, { backgroundColor: CATS[cur.cat].hex }]} />
                <Text style={styles.ccTask}>{cur.title}</Text>
              </View>
              <Text style={styles.ccRemain}>
                {fmt(cur.end)} まで・あと{durLabel(remain)}
              </Text>
            </>
          )}
        </View>
        {tip && (
          <View style={styles.tip}>
            <Text style={{ fontSize: 12 }}>
              <Text style={{ color: CATS[tip.cat].hex, fontWeight: '700' }}>
                {CATS[tip.cat].icon} {tip.title}
              </Text>
              <Text style={{ color: T.ink2 }}>
                {'  '}{fmt(tip.start)}–{fmt(tip.end)} ({durLabel(dur(tip))})
              </Text>
            </Text>
          </View>
        )}
      </View>

      <Legend />

      <View style={styles.tlHead} onLayout={(e) => (tlOffset.current = e.nativeEvent.layout.y)}>
        <Text style={styles.tlHeadTitle}>タイムライン</Text>
        <Text style={styles.tlHeadNote}>円グラフをタップで該当カードへ</Text>
      </View>
      <View style={styles.tl}>
        {SCHEDULE.map((e) => (
          <TimelineItem key={e.id} event={e} now={now} flash={flashId === e.id} onLayoutY={onLayoutY} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  h1: { fontSize: 20, fontWeight: '700', color: T.ink },
  date: { fontSize: 13, color: T.ink2, marginTop: 2 },

  clockWrap: { alignSelf: 'center', width: '92%', maxWidth: 360, aspectRatio: 1, marginTop: 6 },
  clockCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ccDay: { fontSize: 11, color: T.ink3, letterSpacing: 1, marginBottom: 2 },
  ccTime: { fontSize: 34, fontWeight: '800', color: T.ink, fontVariant: ['tabular-nums'] },
  ccChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line,
    borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4,
  },
  ccDot: { width: 8, height: 8, borderRadius: 4 },
  ccTask: { fontSize: 12, fontWeight: '600', color: T.ink },
  ccRemain: { fontSize: 11, color: T.ink2, marginTop: 5 },
  tip: {
    position: 'absolute', top: 4, alignSelf: 'center',
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
  },

  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, columnGap: 14, marginTop: 4, marginBottom: 18, paddingHorizontal: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, color: T.ink2 },
  legendHours: { color: T.ink, fontWeight: '600' },

  tlHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 18, marginBottom: 12 },
  tlHeadTitle: { fontSize: 16, fontWeight: '700', color: T.ink },
  tlHeadNote: { fontSize: 11, color: T.ink3 },

  tl: { paddingHorizontal: 14 },
  tlItem: { flexDirection: 'row', marginBottom: 14 },
  tlTime: { width: 48, textAlign: 'right', fontSize: 13, fontWeight: '600', color: T.ink2, marginTop: 14, fontVariant: ['tabular-nums'] },
  tlLineCol: { width: 20, alignItems: 'center' },
  tlLine: { position: 'absolute', top: 0, bottom: -14, width: 2, backgroundColor: T.line },
  tlNode: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: T.surface, marginTop: 19 },

  card: {
    flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
    borderRadius: 14, borderLeftWidth: 4, padding: 13,
  },
  row1: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: T.ink, flex: 1 },
  range: { fontSize: 12, color: T.ink2, marginTop: 2, fontVariant: ['tabular-nums'] },
  catTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
  catTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  nowBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2 },
  nowBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  nowBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#fff' },

  subs: { marginTop: 10, borderTopWidth: 1, borderTopColor: T.line, borderStyle: 'dashed', paddingTop: 8, gap: 5 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.ink3 },
  subName: { flex: 1, fontSize: 13, color: T.ink2 },
  subDone: { textDecorationLine: 'line-through' },
  subTime: { fontSize: 12, color: T.ink3, fontVariant: ['tabular-nums'] },

  progressWrap: { marginTop: 12 },
  progressBar: { height: 6, backgroundColor: T.surface2, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  progressText: { fontSize: 11, color: T.ink2, fontVariant: ['tabular-nums'] },
});
