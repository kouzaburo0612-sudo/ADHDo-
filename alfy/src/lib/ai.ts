import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "./supabaseAdmin";
import { todayJst, weekdayOf, WEEKDAYS_JA } from "./jst";

// 仕様書 §1: claude-sonnet-4-6 を使用(環境変数で差し替え可能)
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

export type Candidate = { date: string; start: string | null; end: string | null };

export type ImageInput = { mediaType: string; base64: string };

// レスポンス本文からJSONオブジェクトを取り出す(コードフェンス等が混ざっても耐える)
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI応答からJSONを抽出できませんでした");
  }
}

async function logUsage(eventCode: string | null, kind: "candidates" | "auto_answer") {
  try {
    await supabaseAdmin().from("ai_usage").insert({ event_code: eventCode, kind });
  } catch {
    // ログ失敗は本処理を妨げない
  }
}

// 複数写真(上限5枚)を1回のAPI呼び出しにまとめる:
// imageブロックを枚数分並べ、最後にtextブロックで抽出指示を置く(要件B-2)
function buildUserContent(
  text: string,
  images: ImageInput[]
): Anthropic.MessageParam["content"] {
  if (images.length === 0) return text;
  const blocks: Exclude<Anthropic.MessageParam["content"], string> = images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: img.base64,
    },
  }));
  blocks.push({ type: "text", text });
  return blocks;
}

// 写真・テキスト併用時の共通ルール(要件B-2, B-4)
function imageRules(images: ImageInput[], freeText: string): string[] {
  if (images.length === 0) return [];
  const rules = [
    `添付した${images.length}枚の写真は同一人物の予定表です。複数ページある場合は全ページを統合して空き時間を抽出し、重複する時間帯は1つにまとめてください。`,
  ];
  if (freeText.trim()) {
    rules.push(`テキスト入力もあります。写真とテキストを合算して抽出・判断してください。`);
  }
  return rules;
}

// §5a 候補生成: 空き情報の自由文(+写真) → 候補枠
export async function generateCandidates(params: {
  freeText: string;
  images: ImageInput[];
  durationMinutes: number | null; // null = 終日
  maxCandidates: number | null; // null = できるだけ
  periodFrom: string | null;
  periodTo: string | null;
  timeFrom: string | null;
  timeTo: string | null;
  ngWeekdays: number[]; // 0=日〜6=土(要件A)
  eventCode: string | null;
}): Promise<Candidate[]> {
  const today = todayJst();
  const isAllDay = params.durationMinutes == null;

  const rules = [
    `今日はJSTで ${today} です。「来週」「今週金曜」などの相対表現はこの日付を基準に解釈してください。年の指定がない日付は、今日以降の直近の日付として解釈してください。`,
    isAllDay
      ? `所要時間は「終日」です。候補は日付のみとし、start と end は null にしてください。`
      : `所要時間は ${params.durationMinutes} 分です。ユーザーの空き時間がそれより長い場合は、空き時間の先頭から ${params.durationMinutes} 分ごとに区切って候補を作ってください。`,
    `ユーザーが書いた空き時間の範囲内でのみ候補を作ってください(勝手に空きを追加しない)。`,
    ...imageRules(params.images, params.freeText),
  ];
  if (params.periodFrom || params.periodTo) {
    rules.push(
      `候補期間: ${params.periodFrom ?? "指定なし"} 〜 ${params.periodTo ?? "指定なし"}。範囲外の日付は除外してください。`
    );
  }
  if (params.timeFrom || params.timeTo) {
    rules.push(
      `時間帯フィルタ: ${params.timeFrom ?? ""}〜${params.timeTo ?? ""}。この時間帯の範囲外は除外してください。`
    );
  }
  if (params.ngWeekdays.length > 0) {
    const names = params.ngWeekdays.map((d) => `${WEEKDAYS_JA[d]}曜日`).join("・");
    rules.push(`以下の曜日は候補にしない: ${names}`);
  }
  if (params.maxCandidates != null) {
    rules.push(`候補は最大 ${params.maxCandidates} 件までにしてください。`);
  }
  rules.push(
    `出力は次の形式のJSONのみを返してください。説明文・コードフェンスは一切不要です: {"candidates":[{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}]} (終日の場合 start と end は null)`
  );

  const userText = `以下はイベント作成者が入力した空き時間の情報です。ここから日程候補の枠を作ってください。

<空き情報>
${params.freeText || "(テキストなし。添付画像から読み取ってください)"}
</空き情報>

ルール:
${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "あなたは日程調整アシスタントです。入力された空き時間情報から日程候補をJSONで出力します。JSONのみを出力し、それ以外のテキストは出力しないでください。",
    messages: [{ role: "user", content: buildUserContent(userText, params.images) }],
  });

  await logUsage(params.eventCode, "candidates");

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI応答が空でした");
  }
  const parsed = extractJson(textBlock.text) as { candidates?: unknown };
  if (!Array.isArray(parsed.candidates)) {
    throw new Error("AI応答の形式が不正です");
  }
  const candidates: Candidate[] = [];
  for (const c of parsed.candidates) {
    if (typeof c !== "object" || c === null) continue;
    const { date, start, end } = c as Record<string, unknown>;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const okTime = (t: unknown) => t == null || (typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
    if (!okTime(start) || !okTime(end)) continue;
    candidates.push({
      date,
      start: (start as string | null) ?? null,
      end: (end as string | null) ?? null,
    });
  }

  // NG曜日はAI任せにせず、サーバー側でも二重にフィルタして保証する(要件A-3)
  const ngSet = new Set(params.ngWeekdays);
  return candidates.filter((c) => !ngSet.has(weekdayOf(c.date)));
}

// §5b 自動回答: 空き情報 → 候補ごとの yes/maybe/no
export async function generateAutoAnswers(params: {
  freeText: string;
  images: ImageInput[];
  slots: { date: string; start_time: string | null; end_time: string | null }[];
  eventCode: string | null;
}): Promise<("yes" | "maybe" | "no")[]> {
  const today = todayJst();
  const slotList = params.slots
    .map(
      (s, i) =>
        `${i + 1}. ${s.date} ${s.start_time ? `${s.start_time.slice(0, 5)}〜${s.end_time?.slice(0, 5) ?? ""}` : "終日"}`
    )
    .join("\n");

  const extraRules = imageRules(params.images, params.freeText)
    .map((r, i) => `${7 + i}. ${r}`)
    .join("\n");

  const userText = `以下は回答者が入力した予定・空き時間の情報です。各候補枠について出欠(yes/maybe/no)を判定してください。

<回答者の情報>
${params.freeText || "(テキストなし。添付画像から読み取ってください)"}
</回答者の情報>

<候補枠>
${slotList}
</候補枠>

判定ルール:
1. 今日はJSTで ${today} です。相対的な日付表現はこの日付を基準に解釈してください。
2. 候補枠が回答者の空き時間に完全に含まれる → "yes"
3. 一部だけ重なる・調整可能と読める → "maybe"
4. 空いていない・NG条件(「火曜日は難しい」等)に該当 → "no"
5. 判断できない場合 → "maybe"
6. 出力は次の形式のJSONのみ: {"answers":["yes","no","maybe", ...]} (候補枠と同数・同順)${extraRules ? `\n${extraRules}` : ""}`;

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "あなたは日程調整アシスタントです。回答者の予定情報から各候補枠の出欠をJSONで判定します。JSONのみを出力し、それ以外のテキストは出力しないでください。",
    messages: [{ role: "user", content: buildUserContent(userText, params.images) }],
  });

  await logUsage(params.eventCode, "auto_answer");

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI応答が空でした");
  }
  const parsed = extractJson(textBlock.text) as { answers?: unknown };
  if (!Array.isArray(parsed.answers)) {
    throw new Error("AI応答の形式が不正です");
  }
  const valid = new Set(["yes", "maybe", "no"]);
  const answers = parsed.answers.map((a) => (valid.has(a as string) ? (a as "yes" | "maybe" | "no") : "maybe"));
  // 候補と同数になるよう調整(不足はmaybe埋め、超過は切り捨て)
  while (answers.length < params.slots.length) answers.push("maybe");
  return answers.slice(0, params.slots.length);
}
