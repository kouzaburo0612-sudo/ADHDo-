/**
 * アファメーションの「1画面1メッセージ」分割(純関数)。
 * 意味のまとまり(文)ごとに区切る。原文は改変しない(表示時の分割のみ)。
 */
export function splitSentences(body: string): string[] {
  const parts = body
    .split(/(?<=[。!?!?])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [body];
}
