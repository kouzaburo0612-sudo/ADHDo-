/**
 * 食事写真のPFC推定 (Anthropic Messages API vision)
 * 写真をbase64で送り、構造化されたJSON(料理名・kcal・P/F/C)を受け取る。
 */
import { getApiKey } from '@/lib/settings';

const MODEL = 'claude-sonnet-4-6';

export interface FoodEstimate {
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  note?: string;
}

export async function estimateFoodFromPhoto(base64: string, mediaType: string, hint?: string): Promise<FoodEstimate> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      output_config: { effort: 'medium' },
      system: '食事写真の栄養推定係。写真の食事を分析し、JSONのみを返す(説明文なし)。形式: {"name":"料理名(日本語・簡潔)","kcal":数値,"protein":数値,"fat":数値,"carbs":数値,"note":"推定根拠を20字以内"}。量は見た目から推定。複数品は合計する。',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: hint ? `この食事を分析して。補足: ${hint}` : 'この食事を分析して。' },
        ],
      }],
    }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('BAD_API_KEY');
    if (res.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(`API_ERROR_${res.status}`);
  }

  const data: { content?: { type: string; text?: string }[] } = await res.json();
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('PARSE_ERROR');
  const j = JSON.parse(match[0]);
  return {
    name: String(j.name ?? '食事'),
    kcal: Math.round(Number(j.kcal) || 0),
    protein: Math.round(Number(j.protein) || 0),
    fat: Math.round(Number(j.fat) || 0),
    carbs: Math.round(Number(j.carbs) || 0),
    note: j.note ? String(j.note) : undefined,
  };
}
