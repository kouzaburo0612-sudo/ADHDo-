import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateCode, generateAdminToken } from "@/lib/id";
import { addDays, todayJst } from "@/lib/jst";

export const runtime = "nodejs";

type SlotInput = { date: string; start: string | null; end: string | null };

// イベント作成(候補枠確定後の保存 — 画面フロー §3-5)
export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    durationMinutes?: number | null;
    deadline?: string | null;
    periodFrom?: string | null;
    periodTo?: string | null;
    timeFrom?: string | null;
    timeTo?: string | null;
    ngWeekdays?: unknown;
    slots?: SlotInput[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "イベント名は必須です" }, { status: 400 });
  }
  const slots = body.slots ?? [];
  if (slots.length === 0) {
    return NextResponse.json({ error: "候補枠がありません" }, { status: 400 });
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const timeRe = /^\d{2}:\d{2}$/;
  for (const s of slots) {
    if (!dateRe.test(s.date)) {
      return NextResponse.json({ error: "候補枠の日付が不正です" }, { status: 400 });
    }
    if ((s.start && !timeRe.test(s.start)) || (s.end && !timeRe.test(s.end))) {
      return NextResponse.json({ error: "候補枠の時刻が不正です" }, { status: 400 });
    }
  }

  const ngWeekdays = Array.isArray(body.ngWeekdays)
    ? body.ngWeekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];

  const db = supabaseAdmin();
  const code = generateCode();
  const adminToken = generateAdminToken();

  // 30日自動削除: 締切があれば締切+30日、なければ作成日+30日(確定時に更新)
  const baseDate = body.deadline && dateRe.test(body.deadline) ? body.deadline : todayJst();
  const deleteAt = `${addDays(baseDate, 30)}T00:00:00+09:00`;

  const { data: event, error } = await db
    .from("events")
    .insert({
      code,
      admin_token: adminToken,
      title,
      duration_minutes: body.durationMinutes ?? null,
      deadline: body.deadline || null,
      period_from: body.periodFrom || null,
      period_to: body.periodTo || null,
      time_from: body.timeFrom || null,
      time_to: body.timeTo || null,
      // マイグレーション未適用のDBでも作成が失敗しないよう、選択時のみ送る
      ...(ngWeekdays.length > 0 ? { ng_weekdays: ngWeekdays } : {}),
      delete_at: deleteAt,
    })
    .select("id, code")
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "イベントの作成に失敗しました" }, { status: 500 });
  }

  const { error: slotError } = await db.from("slots").insert(
    slots.map((s, i) => ({
      event_id: event.id,
      date: s.date,
      start_time: s.start,
      end_time: s.end,
      sort_order: i,
    }))
  );

  if (slotError) {
    await db.from("events").delete().eq("id", event.id);
    return NextResponse.json({ error: "候補枠の保存に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ code: event.code, adminToken });
}
