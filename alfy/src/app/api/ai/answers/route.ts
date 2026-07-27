import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAutoAnswers, ImageInput } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGES = 5;

function parseImages(raw: unknown): ImageInput[] {
  if (!Array.isArray(raw)) return [];
  const images: ImageInput[] = [];
  for (const item of raw.slice(0, MAX_IMAGES)) {
    if (typeof item !== "object" || item === null) continue;
    const { base64, mediaType } = item as Record<string, unknown>;
    if (typeof base64 === "string" && base64 && typeof mediaType === "string" && mediaType) {
      images.push({ base64, mediaType });
    }
  }
  return images;
}

// AI自動回答 — 仕様書 §5b / 追加要件B(写真複数枚)
export async function POST(req: NextRequest) {
  let body: {
    code?: string;
    freeText?: string;
    images?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const freeText = (body.freeText ?? "").trim();
  const images = parseImages(body.images);
  if (!freeText && images.length === 0) {
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
      images,
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
