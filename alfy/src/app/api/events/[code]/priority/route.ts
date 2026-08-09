import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadEventMeta, saveEventMeta, META_LAST_NAME } from "@/lib/eventMeta";

export const runtime = "nodejs";

// 参加者の重要度設定(幹事メニュー・調整さん方式で誰でも操作可能)
// required=必須 / preferred=できれば / null=ふつう
// 保存先はメタ行のJSON(マイグレーション不要)。priority列があれば併記する。
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  let body: { participantId?: string; priority?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const priority =
    body.priority === "required" || body.priority === "preferred"
      ? body.priority
      : null;

  const db = supabaseAdmin();
  const { data: event } = await db
    .from("events")
    .select("id")
    .eq("code", params.code)
    .single();
  if (!event) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  // 対象参加者の存在確認(メタ行そのものは対象外)
  const { data: target } = await db
    .from("participants")
    .select("id, last_name")
    .eq("id", body.participantId ?? "")
    .eq("event_id", event.id)
    .single();
  if (!target || target.last_name === META_LAST_NAME) {
    return NextResponse.json({ error: "参加者が見つかりません" }, { status: 404 });
  }

  const { rowId, meta } = await loadEventMeta(db, event.id);
  const priorities = { ...(meta.priorities ?? {}) };
  if (priority) {
    priorities[target.id] = priority;
  } else {
    delete priorities[target.id];
  }
  const saved = await saveEventMeta(db, event.id, rowId, { ...meta, priorities });
  if (!saved) {
    return NextResponse.json(
      { error: "重要度を保存できませんでした" },
      { status: 500 }
    );
  }

  // priority列が存在する環境では列にも反映しておく(無ければ黙って失敗してよい)
  await db
    .from("participants")
    .update({ priority })
    .eq("id", target.id)
    .then(() => {});

  return NextResponse.json({ ok: true });
}
