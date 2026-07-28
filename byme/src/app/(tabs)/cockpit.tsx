import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KpiCard } from '../../components/kpi-card';
import { Tri } from '../../components/tri';
import {
  BODY_HABITS,
  DEADLINE_2026,
  DEADLINE_IPO,
  HEALTH_TARGETS_2026,
  REVENUE_BREAKDOWN,
  SLEEP_RULES,
} from '../../data/master';
import { daysUntil } from '../../lib/dates';
import { todaysCreed, todaysPrinciple, useAppStore } from '../../store/useAppStore';
import { colors, enLabel, fonts, spacing } from '../../theme/tokens';

function fmtDate(): string {
  const d = new Date();
  const w = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${w}`;
}

export default function Cockpit() {
  const kpis = useAppStore((s) => s.kpis);
  const principles = useAppStore((s) => s.principles);
  const todayLog = useAppStore((s) => s.todayLog);
  const streak = useAppStore((s) => s.streak);
  const updateKpiCurrent = useAppStore((s) => s.updateKpiCurrent);
  const setTodayField = useAppStore((s) => s.setTodayField);
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);

  const creed = todaysCreed();
  const principle = todaysPrinciple(principles);
  const d2026 = daysUntil(DEADLINE_2026);
  const dIpo = daysUntil(DEADLINE_IPO);
  const isSunday = new Date().getDay() === 0;
  const [bodyRefOpen, setBodyRefOpen] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ブランド行 */}
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <Text style={styles.brandText}>B</Text>
            <Text style={[styles.brandText, { color: colors.blue }]}>Y</Text>
            <Text style={styles.brandText}>ME</Text>
          </View>
          <View style={styles.brandRight}>
            <Text style={styles.date}>{fmtDate()}</Text>
            <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
              <Text style={styles.settingsLink}>設定</Text>
            </Pressable>
          </View>
        </View>

        {/* 指針バー(常時表示・二段) */}
        <View style={styles.creedBar}>
          <Text style={styles.creedLabel}>TODAY’S CREED — 今日の指針</Text>
          <Text style={styles.creedText}>{creed}</Text>
          {principle ? (
            <Text style={styles.creedSub}>
              {principle.category} — {principle.text}
            </Text>
          ) : null}
          <Pressable
            style={[styles.creedCheck, todayLog.principle === 1 && styles.creedCheckDone]}
            onPress={async () => {
              await setTodayField('principle', todayLog.principle !== 1);
              await refreshNotifications();
            }}
          >
            <Text style={[styles.creedCheckText, todayLog.principle === 1 && styles.creedCheckTextDone]}>
              {todayLog.principle === 1 ? '✓ 刻んだ' : '胸に刻んだ'}
            </Text>
          </Pressable>
        </View>

        {/* 週次レビュー(日曜) */}
        {isSunday ? (
          <View style={styles.weekly}>
            <Text style={styles.weeklyLabel}>SUNDAY — 今週の更新</Text>
            <Text style={styles.weeklyText}>KPI現在値を更新し、クエストをチェックせよ。</Text>
            <Pressable onPress={() => router.push('/(tabs)/quest')} hitSlop={8}>
              <Text style={styles.weeklyLink}>▸ クエストを開く</Text>
            </Pressable>
          </View>
        ) : null}

        {/* 期限ヒーロー */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>2026年 目標達成まで</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroNum}>{d2026}</Text>
            <Text style={styles.heroUnit}>DAYS</Text>
          </View>
          <Text style={styles.heroSub}>
            1日も、1円も、ごまかせない。/ 2034年IPOまで {dIpo}日
          </Text>
          <View style={styles.streakChip}>
            <Tri size={8} color={colors.blue} />
            <Text style={styles.streakText}>
              {streak}
              <Text style={styles.streakUnit}> 日連続</Text>
            </Text>
          </View>
        </View>

        {/* 上映ボタン */}
        <Pressable
          style={[styles.playBtn, todayLog.theater === 1 && styles.playBtnDone]}
          onPress={() => router.push('/theater')}
        >
          <View style={styles.playTri} />
          <Text style={styles.playText}>
            {todayLog.theater === 1 ? 'もう一度、未来を観る' : '今日の上映を始める — 3分'}
          </Text>
        </Pressable>

        {/* THE NUMBERS */}
        <View style={styles.section}>
          <Text style={styles.secLabel}>THE NUMBERS — 2026</Text>
          {kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} onUpdate={(v) => updateKpiCurrent(k.id, v)} />
          ))}
          <Text style={styles.breakdown}>内訳(売上17.2億): {REVENUE_BREAKDOWN}</Text>
        </View>

        {/* BODY */}
        <View style={styles.section}>
          <Text style={styles.secLabel}>BODY — 常にやること3つ</Text>
          <View style={styles.bodyCard}>
            {BODY_HABITS.map((h) => {
              const done = todayLog[h.key] === 1;
              return (
                <Pressable
                  key={h.key}
                  style={styles.bodyRow}
                  onPress={() => setTodayField(h.key, !done)}
                >
                  <View style={[styles.bodyBox, done && styles.bodyBoxDone]}>
                    {done ? <Text style={styles.bodyBoxCheck}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bodyLabel, done && styles.bodyLabelDone]}>{h.label}</Text>
                    <Text style={styles.bodyNote}>{h.note}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setBodyRefOpen(!bodyRefOpen)} hitSlop={8}>
              <Text style={styles.sleepLink}>
                {bodyRefOpen ? '▾ 閉じる' : '▸ 絶対遵守7つの睡眠ルール / 2026年 健康数値目標'}
              </Text>
            </Pressable>
            {bodyRefOpen ? (
              <View style={styles.sleepBox}>
                {SLEEP_RULES.map((r, i) => (
                  <Text key={i} style={styles.sleepRule}>
                    {i + 1}. {r}
                  </Text>
                ))}
                <Text style={styles.healthLabel}>2026年 健康数値目標</Text>
                <Text style={styles.healthText}>{HEALTH_TARGETS_2026}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  brand: {
    flexDirection: 'row',
  },
  brandText: {
    fontFamily: fonts.enSemi,
    fontSize: 19,
    letterSpacing: 6,
    color: colors.ink,
  },
  brandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  date: {
    fontFamily: fonts.en,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.mist,
  },
  settingsLink: {
    fontFamily: fonts.jp,
    fontSize: 12,
    color: colors.mist,
  },
  creedBar: {
    marginHorizontal: spacing.screenX,
    marginTop: 16,
    backgroundColor: colors.ink,
    borderRadius: 12,
    padding: 16,
  },
  creedLabel: {
    ...enLabel,
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  creedText: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    lineHeight: 25,
    color: colors.white,
  },
  creedSub: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 6,
  },
  creedCheck: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  creedCheckDone: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  creedCheckText: {
    fontFamily: fonts.jpMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  creedCheckTextDone: {
    color: colors.white,
  },
  weekly: {
    marginHorizontal: spacing.screenX,
    marginTop: 12,
    backgroundColor: colors.bluePale,
    borderRadius: 12,
    padding: 14,
  },
  weeklyLabel: {
    ...enLabel,
    fontSize: 9,
    color: colors.blueDeep,
    marginBottom: 4,
  },
  weeklyText: {
    fontFamily: fonts.jpBold,
    fontSize: 13,
    color: colors.ink,
  },
  weeklyLink: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.blueDeep,
    marginTop: 6,
  },
  hero: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 24,
    paddingBottom: 4,
  },
  heroLabel: {
    ...enLabel,
    fontSize: 11,
    color: colors.mist,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  heroNum: {
    fontFamily: fonts.enSemi,
    fontSize: 88,
    lineHeight: 96,
    letterSpacing: -1,
    color: colors.ink,
  },
  heroUnit: {
    fontFamily: fonts.en,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.mist,
  },
  heroSub: {
    fontFamily: fonts.jpBold,
    fontSize: 12,
    color: colors.red,
    marginTop: 4,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
  },
  streakText: {
    fontFamily: fonts.enSemi,
    fontSize: 13,
    color: colors.ink,
  },
  streakUnit: {
    fontFamily: fonts.jp,
    fontSize: 10,
    color: colors.mist,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginHorizontal: spacing.screenX,
    marginTop: 14,
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: colors.blueDeep,
  },
  playBtnDone: {
    backgroundColor: colors.inkSoft,
  },
  playTri: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.white,
  },
  playText: {
    fontFamily: fonts.jpBold,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.white,
  },
  section: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
  },
  secLabel: {
    ...enLabel,
    fontSize: 11,
    color: colors.mist,
    marginBottom: 10,
  },
  breakdown: {
    fontFamily: fonts.jp,
    fontSize: 10,
    lineHeight: 17,
    color: colors.mist,
    marginTop: 2,
  },
  bodyCard: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bodyBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyBoxDone: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  bodyBoxCheck: {
    color: colors.white,
    fontSize: 14,
    fontFamily: fonts.jpBold,
  },
  bodyLabel: {
    fontFamily: fonts.jpBold,
    fontSize: 14,
    color: colors.ink,
  },
  bodyLabelDone: {
    color: colors.blueDeep,
  },
  bodyNote: {
    fontFamily: fonts.jp,
    fontSize: 11,
    color: colors.mist,
    marginTop: 1,
  },
  sleepLink: {
    fontFamily: fonts.jpMedium,
    fontSize: 12,
    color: colors.blueDeep,
  },
  sleepBox: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    padding: 12,
    gap: 5,
  },
  sleepRule: {
    fontFamily: fonts.jp,
    fontSize: 12,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  healthLabel: {
    fontFamily: fonts.jpBold,
    fontSize: 12,
    color: colors.ink,
    marginTop: 8,
  },
  healthText: {
    fontFamily: fonts.jp,
    fontSize: 11,
    lineHeight: 19,
    color: colors.inkSoft,
  },
});
