// B層スクレイパー: 将棋連盟LIVE中継 (live.shogi.or.jp)
// !!! 現在 OFF !!!

import { NextResponse } from "next/server";

const ENABLED = false;

export async function GET(req: Request) {
  if (!ENABLED) {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ enabled: true, message: "未実装" });
}
