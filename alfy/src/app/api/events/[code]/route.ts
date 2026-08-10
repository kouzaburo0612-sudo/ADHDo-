import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isMetaRow, parseMeta } from "@/lib/eventMeta";

export const runtime = "nodejs";

// イベント名の変更(調整さん方式: URLを知っている人なら誰でも操作可能)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const title = (body.title ?? "").trim().slice(0, 100);
  if (!title) {
    return NextResponse.json({ error: "イベント名を入力してください" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("events")
    .update({ title })
    .eq("code", params.code)
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "イベント名を変更できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

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

  // メタ行(memo・重要度をJSONで保持する隠し行)を分離し、一覧からは必ず除外する
  const allParticipants = participants ?? [];
  const metaRow = allParticipants.find((p) => isMetaRow(p));
  const meta = metaRow ? parseMeta(metaRow.first_name) : {};
  const visibleParticipants = allParticipants.filter((p) => !isMetaRow(p));

  return NextResponse.json({
    event: {
      code: event.code,
      title: event.title,
      durationMinutes: event.duration_minutes,
      deadline: event.deadline,
      memo: event.memo ?? meta.memo ?? null,
      status: event.status,
      confirmedSlotId: event.confirmed_slot_id,
      isAdmin,
    },
    slots: slots ?? [],
    participants: visibleParticipants.map((p) => ({
      id: p.id,
      last_name: p.last_name,
      first_name: p.first_name,
      proxy_last_name: p.proxy_last_name,
      proxy_first_name: p.proxy_first_name,
      priority: meta.priorities?.[p.id] ?? p.priority ?? null,
    })),
    responses,
  });
}
