// B層スクレイパー: 将棋連盟公式 (shogi.or.jp) 対局スケジュール
// !!! 現在 OFF (規約確認 & サーバ復旧待ち) !!!

import { NextResponse } from "next/server";

// 有効化する場合は ENABLED を true にし、Vercel Cron からこのエンドポイントを呼ぶ
const ENABLED = false;

export async function GET(req: Request) {
  if (!ENABLED) {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "shogi.or.jp スクレイパーは無効化されています。利用規約確認とサイト復旧後に ENABLED=true にしてデプロイしてください。",
      },
      { status: 200 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // TODO: 規約確認後に実装。手順は以下を想定:
  //   1. https://www.shogi.or.jp/match/ を fetch (適切な User-Agent と低レート 1req/秒)
  //   2. 対局カード/日付/棋戦/棋士名 を抽出
  //   3. matches テーブルに upsert (重複は match_date + tournament + player_a + player_b)
  //   4. live.shogi.or.jp と突合して is_live を設定
  return NextResponse.json({ enabled: true, message: "未実装" });
}
