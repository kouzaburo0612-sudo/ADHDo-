import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMail } from "@/lib/email";
import { addDays, todayJst, formatDateJa } from "@/lib/jst";

export const runtime = "nodejs";

// 締切24時間前の未回答リマインド(毎日 JST 9:00 実行)— 仕様書 §4
// 締切が「明日」のイベントについて、メール登録済み参加者のうち
// 全候補に回答していない人へリマインドを送る。
// ※メール未登録の未回答者には送信できない(連絡先がないため)。
//   その場合は管理ページの「LINE催促文面」で対応する。
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const tomorrow = addDays(todayJst(), 1);

  const { data: events } = await db
    .from("events")
    .select("id, code, title, deadline")
    .eq("status", "open")
    .eq("deadline", tomorrow);

  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  for (const event of events ?? []) {
    const [{ data: slots }, { data: participants }] = await Promise.all([
      db.from("slots").select("id").eq("event_id", event.id),
      db
        .from("participants")
        .select("id, email")
        .eq("event_id", event.id)
        .not("email", "is", null),
    ]);
    const slotCount = (slots ?? []).length;
    if (slotCount === 0) continue;

    for (const p of participants ?? []) {
      const { count } = await db
        .from("responses")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", p.id);
      if ((count ?? 0) >= slotCount) continue; // 全候補回答済み

      if (p.email) {
        const ok = await sendMail(
          p.email,
          `【Alfy】「${event.title}」回答締切は明日です`,
          `「${event.title}」の回答締切(${formatDateJa(event.deadline)})が近づいています。\nまだ回答していない候補があります。\n\n回答はこちら:\n${appUrl}/e/${event.code}\n\n—\nAlfy | 日程調整を、スマートに。`
        );
        if (ok) sent++;
      }
    }
  }

  return NextResponse.json({ sent });
}
