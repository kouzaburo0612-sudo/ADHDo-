import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// 参加者の重要度設定(幹事メニュー・調整さん方式で誰でも操作可能)
// required=必須 / preferred=できれば / null=ふつう
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

  const { error } = await db
    .from("participants")
    .update({ priority })
    .eq("id", body.participantId ?? "")
    .eq("event_id", event.id);

  if (error) {
    return NextResponse.json(
      { error: "重要度を保存できませんでした" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
