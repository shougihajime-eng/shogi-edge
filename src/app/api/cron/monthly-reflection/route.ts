// 月次振り返り cron (仕様書 §9.4)
// 毎月1日 09:00 JST に走行 → 前月分の月次振り返りを生成 + 重み調整提案

import { NextResponse } from "next/server";
import { generateMonthlyReflection } from "@/lib/reflection/aggregate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const out = await generateMonthlyReflection();
    if (!out) {
      return NextResponse.json({ ok: true, message: "no data" });
    }
    return NextResponse.json({
      ok: true,
      month: out.month,
      total: out.total,
      correct: out.correct,
      accuracy: out.accuracy,
      proposals: out.weight_adjustment_proposals_json.length,
    });
  } catch (e) {
    console.error("[cron monthly-reflection]", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
