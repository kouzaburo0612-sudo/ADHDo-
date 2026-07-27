import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// 回答送信(本人 or 代理)。登録不要 — 仕様書 §3-7
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  let body: {
    lastName?: string;
    firstName?: string;
    email?: string;
    proxyLastName?: string;
    proxyFirstName?: string;
    answers?: Record<string, string>; // slotId -> yes/maybe/no
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const lastName = (body.lastName ?? "").trim();
  if (!lastName) {
    return NextResponse.json({ error: "姓は必須です" }, { status: 400 });
  }
  const answers = body.answers ?? {};
  const validAnswers = new Set(["yes", "maybe", "no"]);

  const db = supabaseAdmin();
  const { data: event } = await db
    .from("events")
    .select("id, status")
    .eq("code", params.code)
    .single();
  if (!event) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  const { data: slots } = await db
    .from("slots")
    .select("id")
    .eq("event_id", event.id);
  const slotIds = new Set((slots ?? []).map((s) => s.id));

  const entries = Object.entries(answers).filter(
    ([slotId, answer]) => slotIds.has(slotId) && validAnswers.has(answer)
  );
  if (entries.length === 0) {
    return NextResponse.json({ error: "回答がありません" }, { status: 400 });
  }

  const { data: participant, error: pError } = await db
    .from("participants")
    .insert({
      event_id: event.id,
      last_name: lastName,
      first_name: (body.firstName ?? "").trim() || null,
      email: (body.email ?? "").trim() || null,
      proxy_last_name: (body.proxyLastName ?? "").trim() || null,
      proxy_first_name: (body.proxyFirstName ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (pError || !participant) {
    return NextResponse.json({ error: "回答の保存に失敗しました" }, { status: 500 });
  }

  const { error: rError } = await db.from("responses").insert(
    entries.map(([slotId, answer]) => ({
      slot_id: slotId,
      participant_id: participant.id,
      answer,
    }))
  );

  if (rError) {
    await db.from("participants").delete().eq("id", participant.id);
    return NextResponse.json({ error: "回答の保存に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
