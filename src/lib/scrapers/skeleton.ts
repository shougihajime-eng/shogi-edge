import { NextResponse } from "next/server";
import { isScraperEnabled, lookupScraper } from "./registry";

// =============================================================
// B 層スクレイパー共通テンプレート
// 各サイトは registry.ts に登録されており、envVarName="true" で有効化
// レート制限: 1秒1リクエスト以下
// User-Agent: 明示 ("ShogiEdgeBot/0.1 (+contact: shougi.hajime@gmail.com)")
// =============================================================

const USER_AGENT =
  "ShogiEdgeBot/0.1 (Shogi Edge prediction app; contact shougi.hajime@gmail.com)";

export interface ScraperContext {
  siteKey: string;       // registry.ts のキー
  // 旧 API 互換 (siteName/url/enabled/note は registry から引く)
  siteName?: string;
  url?: string;
  enabled?: boolean;     // 旧: const ENABLED. registry の env var で上書きされる
  note?: string;
}

export function buildScraperHandler(ctx: ScraperContext) {
  return async function GET(req: Request) {
    const entry = lookupScraper(ctx.siteKey);
    const enabled = isScraperEnabled(ctx.siteKey);

    if (!enabled) {
      return NextResponse.json(
        {
          enabled: false,
          site: ctx.siteKey,
          message: `${entry?.siteName ?? ctx.siteName ?? ctx.siteKey} スクレイパーは現在 OFF です。${entry?.note ?? ctx.note ?? ""}`,
          docs: entry?.url ?? ctx.url,
          how_to_enable: entry
            ? `Vercel ダッシュボード → Environment Variables で ${entry.envVarName}=true を追加 → Redeploy`
            : undefined,
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
