/** データ取得フック(HealthKit同期 + SQLite読み出し + スコア計算) */
import { useHealthkitAuthorization } from '@kingstinct/react-native-healthkit';
import { useCallback, useEffect, useMemo, useState } from 'react';

import * as db from '@/lib/db';
import { addDays, daysAgoKey, fromKey, toKey, todayKey } from '@/lib/dates';
import { READ_TYPES } from '@/lib/healthkit';
import { METRICS, type MetricKey } from '@/lib/metrics';
import { DEFAULT_SETTINGS, loadSettings, type Settings } from '@/lib/settings';
import { syncHealthData } from '@/lib/sync';
import { computeTagEffects, detectAnomalies, forecastBodyFat, type Anomaly, type GoalForecast, type TagEffect } from '@/utils/baseline';
import { computeScores, type Scores } from '@/utils/score';

/** HealthKit読み取り許可(nullは判定中) */
export function useHealthAuth() {
  const [status, request] = useHealthkitAuthorization({ toRead: READ_TYPES });
  return { status, request };
}

export interface Dashboard {
  loading: boolean;
  refreshing: boolean;
  settings: Settings;
  today: Partial<Record<MetricKey, number>>;
  scores: Scores;
  anomalies: Anomaly[];
  forecast: GoalForecast | null;
  tags: string[];
  refresh: () => Promise<void>;
  toggleTag: (tag: string) => Promise<void>;
}

const EMPTY_SCORES: Scores = { total: null, sleep: null, recovery: null, body: null, activity: null };

export function useDashboard(): Dashboard {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [today, setToday] = useState<Partial<Record<MetricKey, number>>>({});
  const [scores, setScores] = useState<Scores>(EMPTY_SCORES);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [forecast, setForecast] = useState<GoalForecast | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  const compute = useCallback(async () => {
    const s = await loadSettings();
    const tk = todayKey();
    const range = await db.getRange(daysAgoKey(60), tk);

    const todayMetrics = range.get(tk) ?? {};
    const history: Partial<Record<MetricKey, number[]>> = {};
    for (const [date, day] of range) {
      if (date === tk) continue;
      (Object.keys(day) as MetricKey[]).forEach((k) => {
        (history[k] ??= []).push(day[k]!);
      });
    }

    const bfSeries = (await db.getSeries('body_fat', daysAgoKey(30), tk))
      .map((r) => ({ date: r.date, value: r.value }));

    setSettings(s);
    setToday(todayMetrics);
    setScores(computeScores({ today: todayMetrics, history, settings: s }));
    setAnomalies(detectAnomalies(todayMetrics, history));
    setForecast(forecastBodyFat(bfSeries, s.bodyFatGoal));
    setTags(await db.getTags(tk));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncHealthData();
      await compute();
    } finally {
      setRefreshing(false);
    }
  }, [compute]);

  useEffect(() => {
    (async () => {
      try {
        await compute(); // まずキャッシュから即表示
        await syncHealthData();
        await compute();
      } catch (e) {
        console.warn('dashboard load failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [compute]);

  const toggleTag = useCallback(async (tag: string) => {
    const tk = todayKey();
    const current = await db.getTags(tk);
    if (current.includes(tag)) {
      await db.removeTag(tk, tag);
    } else {
      await db.addTag(tk, tag);
    }
    setTags(await db.getTags(tk));
  }, []);

  return { loading, refreshing, settings, today, scores, anomalies, forecast, tags, refresh, toggleTag };
}

// ---- トレンド画面用 ----

export type RangeMode = 'day' | 'week' | 'month' | 'year';

/** 表示ウィンドウの長さ(日数) */
export const RANGE_DAYS: Record<RangeMode, number> = {
  day: 30,       // 日単位で30日
  week: 26 * 7,  // 週単位で26週
  month: 365,    // 月単位で12ヶ月
  year: 365 * 5, // 年単位で5年
};

export interface SeriesPoint {
  /** バケット先頭日 */
  date: string;
  value: number;
  label: string;
}

function bucketKey(date: string, mode: RangeMode): string {
  const d = fromKey(date);
  if (mode === 'day') return date;
  if (mode === 'week') {
    const dow = (d.getDay() + 6) % 7;
    return toKey(addDays(d, -dow));
  }
  if (mode === 'month') return `${date.slice(0, 7)}-01`;
  return `${date.slice(0, 4)}-01-01`;
}

function bucketLabel(key: string, mode: RangeMode): string {
  const d = fromKey(key);
  if (mode === 'day') return `${d.getMonth() + 1}/${d.getDate()}`;
  if (mode === 'week') return `${d.getMonth() + 1}/${d.getDate()}`;
  if (mode === 'month') return `${d.getFullYear() % 100}/${d.getMonth() + 1}`;
  return `${d.getFullYear()}`;
}

/**
 * 指標の時系列(バケット平均)。anchorKey=ウィンドウ終端日。
 * 合計系(歩数等)も週・月表示では「1日あたり平均」で揃える
 * (バケット間で日数が違っても比較できるようにするため)。
 */
export function useSeries(metric: MetricKey, mode: RangeMode, anchorKey: string) {
  const [points, setPoints] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const from = toKey(addDays(fromKey(anchorKey), -(RANGE_DAYS[mode] - 1)));
        const rows = await db.getSeries(metric, from, anchorKey);
        const buckets = new Map<string, number[]>();
        for (const r of rows) {
          const k = bucketKey(r.date, mode);
          (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(r.value);
        }
        const pts: SeriesPoint[] = [...buckets.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([k, vs]) => ({
            date: k,
            value: vs.reduce((a, b) => a + b, 0) / vs.length,
            label: bucketLabel(k, mode),
          }));
        if (!cancelled) setPoints(pts);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [metric, mode, anchorKey]);

  return { points, loading };
}

/** 比較ビュー: 今日 / 1ヶ月前 / 1年前 (±3日以内の最近傍値) */
export function useComparison(metric: MetricKey) {
  const [values, setValues] = useState<(number | null)[]>([null, null, null]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targets = [todayKey(), daysAgoKey(30), daysAgoKey(365)];
      const out: (number | null)[] = [];
      for (const t of targets) {
        const from = toKey(addDays(fromKey(t), -3));
        const to = toKey(addDays(fromKey(t), 3));
        const rows = await db.getSeries(metric, from, to);
        if (rows.length === 0) { out.push(null); continue; }
        // 目標日に最も近い日の値
        const best = rows.reduce((a, b) =>
          Math.abs(fromKey(b.date).getTime() - fromKey(t).getTime())
          < Math.abs(fromKey(a.date).getTime() - fromKey(t).getTime()) ? b : a);
        out.push(best.value);
      }
      if (!cancelled) setValues(out);
    })();
    return () => { cancelled = true; };
  }, [metric]);

  return values;
}

/** タグ相関分析(過去90日) */
export function useTagEffects() {
  const [effects, setEffects] = useState<TagEffect[]>([]);
  useEffect(() => {
    (async () => {
      const tagDates = await db.getTagDates();
      if (tagDates.size === 0) return;
      const byDate = await db.getRange(daysAgoKey(90), todayKey());
      setEffects(computeTagEffects(tagDates, byDate));
    })();
  }, []);
  return effects;
}

/** メトリクス定義をメモ化して返す小道具 */
export function useMetricDef(key: MetricKey) {
  return useMemo(() => METRICS[key], [key]);
}
