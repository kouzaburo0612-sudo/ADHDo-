import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMail } from "@/lib/email";
import { slotLabel, todayJst, addDays } from "@/lib/jst";

export const runtime = "nodejs";

// 日程確定・取り消し(調整さん方式: URLを知っている人は誰でも操作可能)
// 確定時はメール登録済み参加者へ通知 + delete_at更新 — 仕様書 §3-8,9 / §6-1
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  let body: { slotId?: string; cancel?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: event } = await db
    .from("events")
    .select("id, code, title, status")
    .eq("code", params.code)
    .single();

  if (!event) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  // 確定の取り消し(募集中に戻す)
  if (body.cancel) {
    const { error } = await db
      .from("events")
      .update({ status: "open", confirmed_slot_id: null })
      .eq("id", event.id);
    if (error) {
      return NextResponse.json({ error: "取り消しに失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { data: slot } = await db
    .from("slots")
    .select("id, date, start_time, end_time")
    .eq("id", body.slotId ?? "")
    .eq("event_id", event.id)
    .single();
  if (!slot) {
    return NextResponse.json({ error: "候補枠が見つかりません" }, { status: 404 });
  }

  // 確定から30日後に自動削除
  const deleteAt = `${addDays(todayJst(), 30)}T00:00:00+09:00`;

  const { error } = await db
    .from("events")
    .update({ status: "confirmed", confirmed_slot_id: slot.id, delete_at: deleteAt })
    .eq("id", event.id);

  if (error) {
    return NextResponse.json({ error: "確定に失敗しました" }, { status: 500 });
  }

  // メール登録済みの参加者へ確定通知(自動送信 — 仕様書 §3-9)
  const { data: participants } = await db
    .from("participants")
    .select("email")
    .eq("event_id", event.id)
    .not("email", "is", null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const eventUrl = `${appUrl}/e/${params.code}`;
  const label = slotLabel(slot);
  const emails = Array.from(
    new Set((participants ?? []).map((p) => p.email).filter((e): e is string => !!e))
  );
  await Promise.all(
    emails.map((email) =>
      sendMail(
        email,
        `【Alfy】「${event.title}」の日程が決まりました`,
        `「${event.title}」の日程が決まりました。\n\n日時: ${label}\n\n詳細・カレンダー登録はこちら:\n${eventUrl}\n\n—\nAlfy | 日程調整を、スマートに。`
      )
    )
  );

  return NextResponse.json({ ok: true });
}
