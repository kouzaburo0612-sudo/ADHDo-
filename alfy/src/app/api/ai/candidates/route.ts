import { NextRequest, NextResponse } from "next/server";
import { generateCandidates, ImageInput } from "@/lib/ai";

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

// AI候補生成 — 仕様書 §5a / 追加要件A(NG曜日)・B(写真複数枚)
export async function POST(req: NextRequest) {
  let body: {
    freeText?: string;
    images?: unknown;
    durationMinutes?: number | null;
    maxCandidates?: number | null;
    periodFrom?: string | null;
    periodTo?: string | null;
    timeFrom?: string | null;
    timeTo?: string | null;
    ngWeekdays?: unknown;
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
      { error: "空き時間のテキストまたは写真を入力してください" },
      { status: 400 }
    );
  }
  const ngWeekdays = Array.isArray(body.ngWeekdays)
    ? body.ngWeekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];

  try {
    const candidates = await generateCandidates({
      freeText,
      images,
      durationMinutes: body.durationMinutes ?? null,
      maxCandidates: body.maxCandidates ?? null,
      periodFrom: body.periodFrom ?? null,
      periodTo: body.periodTo ?? null,
      timeFrom: body.timeFrom ?? null,
      timeTo: body.timeTo ?? null,
      ngWeekdays,
      eventCode: null,
    });
    return NextResponse.json({ candidates });
  } catch {
    // AI失敗でも白画面にしない(受入基準 §10)— エラーメッセージを返し画面側で表示
    return NextResponse.json(
      { error: "候補の生成に失敗しました。時間をおいて再度お試しください。" },
      { status: 502 }
    );
  }
}
