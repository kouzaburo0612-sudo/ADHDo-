import { NextRequest, NextResponse } from "next/server";
import { generateCandidates } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// AI候補生成 — 仕様書 §5a
export async function POST(req: NextRequest) {
  let body: {
    freeText?: string;
    imageBase64?: string;
    imageMediaType?: string;
    durationMinutes?: number | null;
    maxCandidates?: number | null;
    periodFrom?: string | null;
    periodTo?: string | null;
    timeFrom?: string | null;
    timeTo?: string | null;
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
      { error: "空き時間のテキストまたは写真を入力してください" },
      { status: 400 }
    );
  }

  try {
    const candidates = await generateCandidates({
      freeText,
      image: hasImage
        ? { base64: body.imageBase64!, mediaType: body.imageMediaType! }
        : null,
      durationMinutes: body.durationMinutes ?? null,
      maxCandidates: body.maxCandidates ?? null,
      periodFrom: body.periodFrom ?? null,
      periodTo: body.periodTo ?? null,
      timeFrom: body.timeFrom ?? null,
      timeTo: body.timeTo ?? null,
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
