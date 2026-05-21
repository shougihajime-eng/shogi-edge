import { NextResponse } from "next/server";

// =============================================================
// B 層スクレイパー共通テンプレート
// 各サイトの規約 (robots.txt / 利用規約) を確認するまでは ENABLED=false で運用
// レート制限: 1秒1リクエスト以下
// User-Agent: 明示 ("ShogiEdgeBot/0.1 (+contact: shougi.hajime@gmail.com)")
// =============================================================

export interface ScraperContext {
  siteKey: string;          // 'shogi-or-jp' など
  siteName: string;         // '日本将棋連盟 公式 対局スケジュール'
  url: string;              // 取得元 URL
  enabled: boolean;         // 規約確認まで false 固定
  note: string;             // 規約確認のメモ
}

const USER_AGENT =
  "ShogiEdgeBot/0.1 (Shogi Edge prediction app; contact shougi.hajime@gmail.com)";

export function buildScraperHandler(ctx: ScraperContext) {
  return async function GET(req: Request) {
    if (!ctx.enabled) {
      return NextResponse.json(
        {
          enabled: false,
          site: ctx.siteKey,
          message: `${ctx.siteName} スクレイパーは現在 OFF です。${ctx.note}`,
          docs: ctx.url,
        },
        { status: 200 },
      );
    }
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      enabled: true,
      site: ctx.siteKey,
      message: "未実装。規約OK確認後にこの関数本体を実装してください。",
      user_agent: USER_AGENT,
      rate_limit: "1 req / sec",
    });
  };
}
