import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAutoAnswers } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// AI自動回答 — 仕様書 §5b
export async function POST(req: NextRequest) {
  let body: {
    code?: string;
    freeText?: string;
    imageBase64?: string;
    imageMediaType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const freeText = (body.freeText ?? "").trim();
  const hasImage = !!(body.imageBase64 && body.imageMediaType);
  if (!freeText && !hasImage) {
    return NextResponse.json(
      { error: "予定のテキストまたは写真を入力してください" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const { data: event } = await db
    .from("events")
    .select("id, code")
    .eq("code", body.code ?? "")
    .single();
  if (!event) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }
  const { data: slots } = await db
    .from("slots")
    .select("id, date, start_time, end_time")
    .eq("event_id", event.id)
    .order("sort_order");
  if (!slots || slots.length === 0) {
    return NextResponse.json({ error: "候補枠がありません" }, { status: 404 });
  }

  try {
    const answers = await generateAutoAnswers({
      freeText,
      image: hasImage
        ? { base64: body.imageBase64!, mediaType: body.imageMediaType! }
        : null,
      slots,
      eventCode: event.code,
    });
    // slotId -> answer で返す
    const bySlot: Record<string, string> = {};
    slots.forEach((s, i) => {
      bySlot[s.id] = answers[i];
    });
    return NextResponse.json({ answers: bySlot });
  } catch {
    return NextResponse.json(
      { error: "自動判定に失敗しました。手動で○△×を選んでください。" },
      { status: 502 }
    );
  }
}
