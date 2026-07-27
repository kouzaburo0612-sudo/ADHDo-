import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// 30日自動削除(Vercel Cron 毎日実行)— 仕様書 §6-1
// slots/participants/responses は on delete cascade で一緒に消える
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("events")
    .delete()
    .lt("delete_at", new Date().toISOString())
    .select("id");

  if (error) {
    return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  }
  return NextResponse.json({ deleted: data?.length ?? 0 });
}
