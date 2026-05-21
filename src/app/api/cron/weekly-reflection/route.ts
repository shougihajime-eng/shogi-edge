// 週次振り返り cron (仕様書 §9.3)
// 毎週月曜 09:00 JST に走行 → 前週分の振り返りを生成して weekly_reflections に保存

import { NextResponse } from "next/server";
import { generateWeeklyReflection } from "@/lib/reflection/aggregate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> を必須にする
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    // テスト用: ?date=YYYY-MM-DD を指定すると、その日を含む週を対象にする
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const referenceDate = dateParam ? new Date(dateParam) : new Date();
    const out = await generateWeeklyReflection(referenceDate);
    if (!out) {
      return NextResponse.json({ ok: true, message: "no data" });
    }
    return NextResponse.json({
      ok: true,
      week: out.week,
      total: out.total,
      correct: out.correct,
      accuracy: out.accuracy,
    });
  } catch (e) {
    console.error("[cron weekly-reflection]", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
