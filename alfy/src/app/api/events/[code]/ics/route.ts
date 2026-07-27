import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildIcs } from "@/lib/ics";

export const runtime = "nodejs";

// 確定日程の .ics ダウンロード — 仕様書 §3-9
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const db = supabaseAdmin();
  const { data: event } = await db
    .from("events")
    .select("id, code, title, status, confirmed_slot_id")
    .eq("code", params.code)
    .single();

  if (!event || event.status !== "confirmed" || !event.confirmed_slot_id) {
    return NextResponse.json({ error: "確定した日程がありません" }, { status: 404 });
  }

  const { data: slot } = await db
    .from("slots")
    .select("date, start_time, end_time")
    .eq("id", event.confirmed_slot_id)
    .single();
  if (!slot) {
    return NextResponse.json({ error: "確定した日程がありません" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const ics = buildIcs({
    uid: event.code,
    title: event.title,
    date: slot.date,
    startTime: slot.start_time,
    endTime: slot.end_time,
    url: `${appUrl}/e/${event.code}`,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="alfy-${event.code}.ics"`,
    },
  });
}
