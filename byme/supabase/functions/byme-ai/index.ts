// BYME AI変換 Edge Function (Supabase / Deno)
// Anthropic APIキーはこのサーバーにのみ置く。クライアントには渡さない。
//
// リクエスト:  POST { task: 'affirmations' | 'identity_mvv', payload: {...} }
//   affirmations: { goals: string[] }
//   identity_mvv: { identityInput: string, valuesInput: string }
// レスポンス(JSON):
//   affirmations: { conversions: [{ goal, affirmation, suggestions: string[] }] }
//   identity_mvv: { identity, mission, vision, values: string[3] }
//
// デプロイ: supabase functions deploy byme-ai --no-verify-jwt
// シークレット: supabase secrets set ANTHROPIC_API_KEY=...

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM = `あなたは目標達成アプリ「BYME」(タグライン: Life, by me.)のアファメーション作家である。
ルール:
- 宣言文は必ず現在進行形・完了形で書く。「〜したい」「〜なりたい」は「〜している」「〜を達成している」に変換する。
- 否定形は肯定形に書き換える(例:「太らない」→「引き締まった体を維持している」)。
- 一人称は「私は、」で始め、「。」で終える。簡潔で確信的な文体。誇張しすぎない。
- 出力は指示されたJSONのみ。説明文・マークダウンは一切出力しない。`;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
}

async function callClaude(userPrompt: string, apiKey: string): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as AnthropicResponse;
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  if (!text) throw new Error('empty completion');
  return text;
}

/** モデル出力からJSONを取り出す(コードフェンス等の混入に耐える) */
function extractJson<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no json in completion');
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/** JSONパース失敗時はリトライ1回(仕様 6.2) */
async function callWithRetry<T>(prompt: string, apiKey: string): Promise<T> {
  try {
    return extractJson<T>(await callClaude(prompt, apiKey));
  } catch {
    return extractJson<T>(await callClaude(prompt, apiKey));
  }
}

function affirmationsPrompt(goals: string[]): string {
  return `次のユーザーの目標それぞれを、宣言文に変換せよ。
各目標について:
1. "affirmation": 現在進行形/完了形の宣言文(1文)
2. "suggestions": イメージングを助ける具体化の提案を2〜3案(情景・数字・期日を足す提案。それぞれ1文の日本語)

目標リスト:
${goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

次のJSONだけを出力せよ:
{"conversions":[{"goal":"元の目標","affirmation":"私は、…している。","suggestions":["…","…"]}]}`;
}

function identityMvvPrompt(identityInput: string, valuesInput: string): string {
  return `ユーザーの「なりたい自分」と「大切にしたいこと」から、アイデンティティ宣言文とMVVを生成せよ。

なりたい自分: ${identityInput}
大切にしたいこと: ${valuesInput}

要件:
- "identity": 「私は、◯◯である。」の一文(アプリのホーム最上部に常時表示される)
- "mission": 使命(1〜2文)
- "vision": 未来の姿(1〜2文、現在形で「〜している」)
- "values": 行動指針3カ条。各行は「一、〜せよ。」形式

次のJSONだけを出力せよ:
{"identity":"私は、…である。","mission":"…","vision":"…","values":["一、…せよ。","一、…せよ。","一、…せよ。"]}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const { task, payload } = (await req.json()) as {
      task: string;
      payload: Record<string, unknown>;
    };

    let result: unknown;
    if (task === 'affirmations') {
      const goals = (payload.goals as string[] | undefined)?.filter(Boolean) ?? [];
      if (goals.length === 0 || goals.length > 20) throw new Error('goals must be 1-20 items');
      result = await callWithRetry(affirmationsPrompt(goals), apiKey);
    } else if (task === 'identity_mvv') {
      const identityInput = String(payload.identityInput ?? '').slice(0, 2000);
      const valuesInput = String(payload.valuesInput ?? '').slice(0, 2000);
      if (!identityInput) throw new Error('identityInput required');
      result = await callWithRetry(identityMvvPrompt(identityInput, valuesInput), apiKey);
    } else {
      throw new Error(`unknown task: ${task}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  }
});
