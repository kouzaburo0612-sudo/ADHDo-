import type { SupabaseClient } from "@supabase/supabase-js";

// マイグレーション不要のイベント付随情報ストア。
// participants テーブルの隠し行(last_name が sentinel 値)の first_name に JSON を保存する。
// SQLエディタで列を追加できない運用でも memo / 重要度 を永続化するための仕組み。
// APIレスポンスでは必ずこの行を除外すること(loadEventMeta / isMetaRow を使う)。
export const META_LAST_NAME = "__alfy_meta__";

export type EventMeta = {
  memo?: string;
  // participantId -> 重要度(required=必須 / preferred=できれば)
  priorities?: Record<string, "required" | "preferred">;
};

export function isMetaRow(p: { last_name?: string | null }): boolean {
  return p.last_name === META_LAST_NAME;
}

export function parseMeta(firstName: string | null | undefined): EventMeta {
  try {
    const v = JSON.parse(firstName ?? "{}");
    return v && typeof v === "object" ? (v as EventMeta) : {};
  } catch {
    return {};
  }
}

export async function loadEventMeta(
  db: SupabaseClient,
  eventId: string
): Promise<{ rowId: string | null; meta: EventMeta }> {
  const { data } = await db
    .from("participants")
    .select("id, first_name")
    .eq("event_id", eventId)
    .eq("last_name", META_LAST_NAME)
    .limit(1);
  const row = data?.[0];
  if (!row) return { rowId: null, meta: {} };
  return { rowId: row.id, meta: parseMeta(row.first_name) };
}

export async function saveEventMeta(
  db: SupabaseClient,
  eventId: string,
  rowId: string | null,
  meta: EventMeta
): Promise<boolean> {
  const json = JSON.stringify(meta);
  if (rowId) {
    const { error } = await db
      .from("participants")
      .update({ first_name: json })
      .eq("id", rowId);
    return !error;
  }
  const { error } = await db
    .from("participants")
    .insert({ event_id: eventId, last_name: META_LAST_NAME, first_name: json });
  return !error;
}
