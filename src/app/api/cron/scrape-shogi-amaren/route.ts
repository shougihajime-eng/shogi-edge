import { buildScraperHandler } from "@/lib/scrapers/skeleton";

// アマ連盟 (アマ棋戦結果)
// https://www.shogi-amaren.com/
export const GET = buildScraperHandler({
  siteKey: "shogi-amaren",
  siteName: "アマ連盟 公式",
  url: "https://www.shogi-amaren.com/",
  enabled: false,
  note: "公式団体。利用規約確認 + 事前連絡後に ON。",
});
