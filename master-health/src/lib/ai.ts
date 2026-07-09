/**
 * AIアドバイス (Anthropic API / claude-sonnet-4-6)
 *
 * コスト方針: 自動生成は1日1回(結果はSQLiteに保存して再利用)。
 * 手動リフレッシュのみ再生成を許可。thinkingオフ + effort低で
 * 短い日本語アドバイスに最適化する。
 */
import Anthropic from '@anthropic-ai/sdk';

import { getReport, saveReport, type ReportRow } from '@/lib/db';
import { todayKey, formatKeyJa } from '@/lib/dates';
import { formatValue, METRICS, type MetricKey } from '@/lib/metrics';
import { getApiKey } from '@/lib/settings';
import type { Anomaly } from '@/utils/baseline';
import type { Scores } from '@/utils/score';

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `あなたはパーソナル健康コーチ。Withings体組成計とOura Ringのデータを見て、日本語でアドバイスする。

文体のルール:
- 簡潔で人間らしい日本語。直訳調(「あなたのスコアは良好です」等)は禁止
- 丁寧すぎない。友人のトレーナーが話すような自然な口調
- 数値は根拠として具体的に引用する
- 医学的診断はしない。気になる兆候は「医師に相談を」で締める
- 全体で400字以内。見出しや箇条書きは最小限`;

export interface DaySummary {
  date: string;
  metrics: Partial<Record<MetricKey, number>>;
  tags: string[];
  scores?: Scores;
}

/** 直近データをテキスト化してプロンプトに渡す */
export function buildDataSummary(days: DaySummary[]): string {
  const lines: string[] = [];
  for (const d of days) {
    const parts: string[] = [];
    (Object.keys(d.metrics) as MetricKey[]).forEach((k) => {
      parts.push(`${METRICS[k].label}${formatValue(k, d.metrics[k])}${METRICS[k].asDuration ? '' : METRICS[k].unit}`);
    });
    if (d.tags.length > 0) parts.push(`タグ:${d.tags.join('・')}`);
    if (d.scores?.total != null) parts.push(`総合スコア${d.scores.total}`);
    lines.push(`${formatKeyJa(d.date)}: ${parts.join(' / ') || 'データなし'}`);
  }
  return lines.join('\n');
}

async function callClaude(userPrompt: string): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) throw new Error('EMPTY_RESPONSE');
    return text;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('BAD_API_KEY');
    if (e instanceof Anthropic.RateLimitError) throw new Error('RATE_LIMITED');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('NETWORK');
    throw e;
  }
}

/** 今日のコンディション解説(1日1回。force=trueで再生成) */
export async function getDailyAdvice(days: DaySummary[], force = false): Promise<ReportRow | null> {
  const date = todayKey();
  if (!force) {
    const cached = await getReport('daily', date);
    if (cached) return cached;
  }
  const content = await callClaude(
    `直近のデータ:\n${buildDataSummary(days)}\n\n今日(${formatKeyJa(date)})のコンディションを解説して。良い点・注意点・今日意識すべきこと1つ。`,
  );
  await saveReport('daily', date, content);
  return getReport('daily', date);
}

/** 週次レポート(週の月曜日付で保存) */
export async function getWeeklyReport(mondayDate: string, days: DaySummary[], force = false): Promise<ReportRow | null> {
  if (!force) {
    const cached = await getReport('weekly', mondayDate);
    if (cached) return cached;
  }
  const content = await callClaude(
    `先週1週間のデータ:\n${buildDataSummary(days)}\n\n先週の総括と、今週の改善提案を2つ。数値の変化に注目して。`,
  );
  await saveReport('weekly', mondayDate, content);
  return getReport('weekly', mondayDate);
}

/** 異常検知時の解説 */
export async function getAnomalyAdvice(anomalies: Anomaly[], days: DaySummary[]): Promise<ReportRow | null> {
  const date = todayKey();
  const cached = await getReport('anomaly', date);
  if (cached) return cached;
  const list = anomalies.map((a) => `${METRICS[a.metric].label} (z=${a.z.toFixed(1)})`).join('、');
  const content = await callClaude(
    `直近のデータ:\n${buildDataSummary(days)}\n\n今日、次の指標がベースラインから逸脱: ${list}。考えられる要因と今日の過ごし方を短く解説して。`,
  );
  await saveReport('anomaly', date, content);
  return getReport('anomaly', date);
}

/** エラーコード → ユーザー向けメッセージ */
export function adviceErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  switch (msg) {
    case 'NO_API_KEY': return 'APIキーが未設定です。設定タブから登録してください。';
    case 'BAD_API_KEY': return 'APIキーが無効です。設定タブで確認してください。';
    case 'RATE_LIMITED': return 'リクエストが集中しています。少し待ってから再試行してください。';
    case 'NETWORK': return 'ネットワークに接続できませんでした。';
    default: return 'アドバイスの生成に失敗しました。時間をおいて再試行してください。';
  }
}
