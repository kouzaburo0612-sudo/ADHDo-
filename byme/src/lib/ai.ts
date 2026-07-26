/**
 * AI変換クライアント。
 * バックエンド(Supabase Edge Function: byme-ai)経由で Anthropic API を呼ぶ。
 * APIキーはクライアントに置かない。
 * エンドポイント未設定・通信失敗時はローカルのルールベース変換にフォールバックし、
 * ユーザーが編集して確定できるようにする。
 */

export interface GoalConversion {
  /** 元の目標 */
  goal: string;
  /** 現在進行形/完了形の宣言文 */
  affirmation: string;
  /** イメージングを助ける具体化サジェスト(2〜3案) */
  suggestions: string[];
}

export interface IdentityMvv {
  /** 「私は、◯◯である。」 */
  identity: string;
  mission: string;
  vision: string;
  /** 「一、〜せよ。」形式の3行 */
  values: string[];
}

export interface AiResult<T> {
  data: T;
  /** true = AI生成 / false = ローカルフォールバック */
  fromAi: boolean;
}

const ENV_ENDPOINT = process.env.EXPO_PUBLIC_BYME_AI_URL ?? '';

function resolveEndpoint(override?: string): string {
  const url = (override ?? '').trim() || ENV_ENDPOINT.trim();
  return url;
}

async function callBackend<T>(
  task: 'affirmations' | 'identity_mvv',
  payload: unknown,
  endpointOverride?: string
): Promise<T> {
  const endpoint = resolveEndpoint(endpointOverride);
  if (!endpoint) throw new Error('AI endpoint not configured');

  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, payload }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`AI backend error: ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  };

  // パース/通信失敗時はリトライ1回 → それでもダメなら呼び出し側でフォールバック
  try {
    return await attempt();
  } catch {
    return await attempt();
  }
}

// ---------- ローカルフォールバック(ルールベース変換) ----------

/** 「〜したい」「〜なりたい」を現在進行形/完了形へ。否定形は素通しせず前向きな文に整える。 */
export function localConvertGoal(goal: string): GoalConversion {
  let t = goal.trim().replace(/[。.]+$/, '');
  const rules: [RegExp, string][] = [
    [/になりたい$/, 'になっている'],
    [/なりたい$/, 'なっている'],
    [/を達成したい$/, 'を達成している'],
    [/が欲しい$/, 'を手にしている'],
    [/がほしい$/, 'を手にしている'],
    [/を?やめたい$/, 'から自由になっている'],
    [/したい$/, 'している'],
    [/たい$/, 'ている'],
    [/を達成する$/, 'を達成している'],
    [/する$/, 'している'],
  ];
  let converted: string | null = null;
  for (const [re, rep] of rules) {
    if (re.test(t)) {
      converted = t.replace(re, rep);
      break;
    }
  }
  if (converted === null) {
    converted = `${t}を達成している`;
  }
  const affirmation = `私は、${converted}。`;
  return {
    goal,
    affirmation,
    suggestions: [
      '期日を入れる(例:「2026年12月までに」)',
      '数字を入れて具体化する(売上・人数・回数など)',
      '達成した瞬間の情景をひと言足す(誰と、どこで、何を感じているか)',
    ],
  };
}

export function localIdentityMvv(identityInput: string, valuesInput: string): IdentityMvv {
  const core = identityInput.trim().replace(/[。.]+$/, '') || '人生を自分の手で創る人間';
  const values = valuesInput
    .split(/\n|、|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  while (values.length < 3) {
    values.push(['今日の一歩を先送りするな', '決めたことをやり切れ', '未来の自分として振る舞え'][values.length]);
  }
  return {
    identity: `私は、${core}である。`,
    mission: `${core}として、周囲と社会に価値を届ける。`,
    vision: `${core}であることが当たり前になった未来を生きている。`,
    values: values.map((v) => `一、${v.replace(/[。.]+$/, '')}。`),
  };
}

// ---------- 公開API ----------

export async function convertGoals(
  goals: string[],
  endpointOverride?: string
): Promise<AiResult<GoalConversion[]>> {
  try {
    const data = await callBackend<{ conversions: GoalConversion[] }>(
      'affirmations',
      { goals },
      endpointOverride
    );
    if (!Array.isArray(data.conversions) || data.conversions.length === 0) {
      throw new Error('empty conversions');
    }
    return { data: data.conversions, fromAi: true };
  } catch {
    return { data: goals.map(localConvertGoal), fromAi: false };
  }
}

export async function generateIdentityMvv(
  identityInput: string,
  valuesInput: string,
  endpointOverride?: string
): Promise<AiResult<IdentityMvv>> {
  try {
    const data = await callBackend<IdentityMvv>(
      'identity_mvv',
      { identityInput, valuesInput },
      endpointOverride
    );
    if (!data.identity || !data.mission || !data.vision || !Array.isArray(data.values)) {
      throw new Error('bad identity_mvv response');
    }
    return { data, fromAi: true };
  } catch {
    return { data: localIdentityMvv(identityInput, valuesInput), fromAi: false };
  }
}
