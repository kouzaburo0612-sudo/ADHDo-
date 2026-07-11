/**
 * チャットへのAI自動投稿
 * - 平日毎朝: 今日のプラン(初回チャット表示時に生成)
 * - 月曜: 先週の週次ダイジェスト
 * 生成済みかどうかはkvで管理し、1日1回/週1回に制限する。
 */
import { kvGet, kvSet } from '@/lib/db';
import { addDays, toKey, todayKey } from '@/lib/dates';
import { sendChat } from '@/lib/chat';
import { appendChat } from '@/lib/store';

const MORNING_KEY = 'autopost_morning_date';
const DIGEST_KEY = 'autopost_digest_week';

/** 今週の月曜の日付キー(週の識別子) */
function weekKey(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  return toKey(addDays(d, -dow));
}

const DIGEST_PROMPT =
  '(自動投稿) 先週1週間のダイジェストを作って。内容: 体重と体脂肪率の変化、カロリー貯金の合計、よかった点1つ、今週の作戦1つ。' +
  '記録ツールは使わない。冒頭は「📈 週次レポート」で始めて、6行以内のプレーンテキストで。';

const MORNING_PROMPT =
  '(自動投稿) 今日の朝プランを作って。内容: 昨日の収支の一言評価、今日の目標摂取カロリーとおすすめの過ごし方(食事・活動)。' +
  '記録ツールは使わない。冒頭は「☀️ 今日のプラン」で始めて、5行以内のプレーンテキストで。';

/**
 * 必要なら自動投稿を生成して返す(表示用)。不要・失敗時はnull。
 * チャット画面のロード時に呼ぶ。
 */
export async function maybeAutoPost(): Promise<string | null> {
  try {
    const now = new Date();
    if (now.getHours() < 5) return null; // 深夜は投稿しない

    const isMonday = now.getDay() === 1;
    const today = todayKey();

    let prompt: string | null = null;
    let commit: (() => Promise<void>) | null = null;

    if (isMonday && (await kvGet(DIGEST_KEY)) !== weekKey()) {
      prompt = DIGEST_PROMPT;
      commit = async () => { await kvSet(DIGEST_KEY, weekKey()); await kvSet(MORNING_KEY, today); };
    } else if ((await kvGet(MORNING_KEY)) !== today) {
      prompt = MORNING_PROMPT;
      commit = async () => { await kvSet(MORNING_KEY, today); };
    }
    if (!prompt || !commit) return null;

    const r = await sendChat(prompt, []);
    if (!r.text) return null;
    await commit();
    await appendChat('assistant', r.text);
    return r.text;
  } catch {
    return null; // APIキー未設定・オフライン等は静かにスキップ
  }
}
