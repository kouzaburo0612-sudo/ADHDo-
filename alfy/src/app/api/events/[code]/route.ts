import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// イベント取得。code だけで回答ページ用データ、code + admin_token で管理判定を返す。
export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const db = supabaseAdmin();
  const token = req.nextUrl.searchParams.get("token");

  // select("*") にしておくと、マイグレーション未適用(列がまだ無い)でも動く
  const { data: event, error } = await db
    .from("events")
    .select("*")
    .eq("code", params.code)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  const isAdmin = token != null && token === event.admin_token;

  const [{ data: slots }, { data: participants }] = await Promise.all([
    db
      .from("slots")
      .select("id, date, start_time, end_time, sort_order")
      .eq("event_id", event.id)
      .order("sort_order"),
    // select("*") でマイグレーション未適用(priority列なし)でも動くようにし、
    // 返却時に必要な列だけへマッピングする(emailは公開しない)
    db
      .from("participants")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at"),
  ]);

  let responses: { slot_id: string; participant_id: string; answer: string }[] = [];
  if (slots && slots.length > 0) {
    const { data } = await db
      .from("responses")
      .select("slot_id, participant_id, answer")
      .in(
        "slot_id",
        slots.map((s) => s.id)
      );
    responses = data ?? [];
  }

  return NextResponse.json({
    event: {
      code: event.code,
      title: event.title,
      durationMinutes: event.duration_minutes,
      deadline: event.deadline,
      memo: event.memo ?? null,
      status: event.status,
      confirmedSlotId: event.confirmed_slot_id,
      isAdmin,
    },
    slots: slots ?? [],
    participants: (participants ?? []).map((p) => ({
      id: p.id,
      last_name: p.last_name,
      first_name: p.first_name,
      proxy_last_name: p.proxy_last_name,
      proxy_first_name: p.proxy_first_name,
      priority: p.priority ?? null,
    })),
    responses,
  });
}
