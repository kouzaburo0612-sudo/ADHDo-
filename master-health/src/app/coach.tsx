/** AIアドバイス(Coach): 今日の解説・週次レポート・異常検知の解説 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, SectionTitle } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import {
  adviceErrorMessage, getAnomalyAdvice, getDailyAdvice, getWeeklyReport, type DaySummary,
} from '@/lib/ai';
import * as db from '@/lib/db';
import { addDays, daysAgoKey, formatKeyJa, fromKey, mondayOf, toKey, todayKey } from '@/lib/dates';
import { getApiKey } from '@/lib/settings';
import { detectAnomalies, type Anomaly } from '@/utils/baseline';
import type { MetricKey } from '@/lib/metrics';

async function buildSummaries(fromDate: string, toDate: string): Promise<DaySummary[]> {
  const range = await db.getRange(fromDate, toDate);
  const out: DaySummary[] = [];
  for (const [date, metrics] of [...range.entries()].sort()) {
    out.push({ date, metrics, tags: await db.getTags(date) });
  }
  return out;
}

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [daily, setDaily] = useState<string | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [weekly, setWeekly] = useState<db.ReportRow[]>([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [anomalyText, setAnomalyText] = useState<string | null>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDaily = useCallback(async (force: boolean) => {
    setDailyLoading(true);
    setError(null);
    try {
      const summaries = await buildSummaries(daysAgoKey(7), todayKey());
      const report = await getDailyAdvice(summaries, force);
      setDaily(report?.content ?? null);
    } catch (e) {
      setError(adviceErrorMessage(e));
    } finally {
      setDailyLoading(false);
    }
  }, []);

  const loadWeekly = useCallback(async (force: boolean) => {
    setWeeklyLoading(true);
    try {
      // 「先週分」= 直近の月曜日付。月曜以降に開くと自動生成される
      const thisMonday = toKey(mondayOf(new Date()));
      const prevMonday = toKey(addDays(fromKey(thisMonday), -7));
      const summaries = await buildSummaries(prevMonday, toKey(addDays(fromKey(thisMonday), -1)));
      if (summaries.length > 0) {
        await getWeeklyReport(thisMonday, summaries, force);
      }
      setWeekly(await db.listReports('weekly'));
    } catch (e) {
      setError(adviceErrorMessage(e));
    } finally {
      setWeeklyLoading(false);
    }
  }, []);

  const loadAnomaly = useCallback(async () => {
    setAnomalyLoading(true);
    try {
      const tk = todayKey();
      const range = await db.getRange(daysAgoKey(60), tk);
      const today = range.get(tk) ?? {};
      const history: Partial<Record<MetricKey, number[]>> = {};
      for (const [date, day] of range) {
        if (date === tk) continue;
        (Object.keys(day) as MetricKey[]).forEach((k) => { (history[k] ??= []).push(day[k]!); });
      }
      const found = detectAnomalies(today, history);
      setAnomalies(found);
      if (found.length > 0) {
        const summaries = await buildSummaries(daysAgoKey(7), tk);
        const report = await getAnomalyAdvice(found, summaries);
        setAnomalyText(report?.content ?? null);
      }
    } catch (e) {
      setError(adviceErrorMessage(e));
    } finally {
      setAnomalyLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const key = await getApiKey();
      setHasKey(key != null);
      if (key == null) {
        setWeekly(await db.listReports('weekly'));
        return;
      }
      // 自動生成は1日1回(キャッシュ済みなら再生成しない)
      await loadDaily(false);
      await loadWeekly(false);
      await loadAnomaly();
    })();
  }, [loadDaily, loadWeekly, loadAnomaly]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: 120, paddingHorizontal: Spacing.md }}
    >
      <Text style={styles.title}>コーチ</Text>

      {hasKey === false && (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            AIアドバイスにはAnthropic APIキーが必要です。設定タブから登録してください。
          </Text>
        </Card>
      )}

      {error && (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      )}

      {/* 今日のコンディション */}
      <SectionTitle>今日のコンディション</SectionTitle>
      <Card>
        {dailyLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ paddingVertical: Spacing.lg }} />
        ) : daily ? (
          <Text style={styles.advice}>{daily}</Text>
        ) : (
          <Text style={styles.emptyText}>まだ生成されていません。</Text>
        )}
        {hasKey && !dailyLoading && (
          <Pressable style={styles.refreshBtn} onPress={() => loadDaily(true)}>
            <Text style={styles.refreshText}>↻ 再生成</Text>
          </Pressable>
        )}
      </Card>

      {/* 異常検知の解説 */}
      {anomalies.length > 0 && (
        <>
          <SectionTitle>体調変化について</SectionTitle>
          <Card style={{ borderColor: Colors.warn, borderWidth: 1 }}>
            {anomalyLoading ? (
              <ActivityIndicator color={Colors.warn} style={{ paddingVertical: Spacing.lg }} />
            ) : (
              <Text style={styles.advice}>{anomalyText ?? '解説を生成できませんでした。'}</Text>
            )}
          </Card>
        </>
      )}

      {/* 週次レポート */}
      <SectionTitle>週次レポート</SectionTitle>
      {weeklyLoading && <ActivityIndicator color={Colors.accent} style={{ paddingVertical: Spacing.md }} />}
      {weekly.length === 0 && !weeklyLoading ? (
        <Card>
          <Text style={styles.emptyText}>
            毎週月曜日に先週の総括が自動生成され、ここに残っていきます。
          </Text>
        </Card>
      ) : (
        weekly.map((r) => (
          <Card key={r.id} style={{ marginBottom: Spacing.sm }}>
            <Text style={styles.weekLabel}>{formatKeyJa(r.date)} の週</Text>
            <Text style={styles.advice}>{r.content}</Text>
          </Card>
        ))
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          生成は1日1回+手動再生成のみ。データは直近7日分のサマリーだけをAPIに送信します。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: Type.title, fontWeight: '700' },
  noticeCard: { marginTop: Spacing.md, borderColor: Colors.accent, borderWidth: 1 },
  noticeText: { color: Colors.text, fontSize: Type.body, lineHeight: 21 },
  errorCard: { marginTop: Spacing.md, borderColor: Colors.bad, borderWidth: 1 },
  errorText: { color: Colors.bad, fontSize: Type.body },
  advice: { color: Colors.text, fontSize: Type.body, lineHeight: 24 },
  emptyText: { color: Colors.textFaint, fontSize: Type.body, lineHeight: 20 },
  refreshBtn: {
    alignSelf: 'flex-end', marginTop: Spacing.sm, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.sm, backgroundColor: Colors.surfaceRaised,
  },
  refreshText: { color: Colors.accent, fontSize: Type.label, fontWeight: '600' },
  weekLabel: { color: Colors.accent, fontSize: Type.label, fontWeight: '700', marginBottom: 6 },
  footer: { marginTop: Spacing.lg },
  footerText: { color: Colors.textFaint, fontSize: Type.caption, lineHeight: 17, textAlign: 'center' },
});
