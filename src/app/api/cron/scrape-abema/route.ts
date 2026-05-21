import { buildScraperHandler } from "@/lib/scrapers/skeleton";

// ABEMA将棋は規約上、自動取得が明確に禁止。registry で priority=99 (ブラックリスト)
// として登録済み。環境変数を設定しても isScraperEnabled が false を返す。
export const GET = buildScraperHandler({ siteKey: "abema" });
