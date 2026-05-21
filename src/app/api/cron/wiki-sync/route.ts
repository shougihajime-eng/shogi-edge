// Wikipedia 自動同期 cron
// ライセンス: Wikipedia は CC-BY-SA 3.0 (出典明記の上で再利用可)
// スケジュール: 週1回 (vercel.json で月曜 03:00 JST = 日曜 18:00 UTC)
// 出典明記: 取得結果は管理画面 /admin/wiki-sync および /admin/scraper-status に表示

import { NextResponse } from "next/server";
import { syncPlayersFromWikipedia } from "@/lib/wiki/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel Cron 経由は Authorization: Bearer <CRON_SECRET> を必須にする
  // (CRON_SECRET 未設定環境ではセキュリティ警告を出しつつ動作させる)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncPlayersFromWikipedia();
    return NextResponse.json({
      ok: result.status !== "error",
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
