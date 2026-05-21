import { buildScraperHandler } from "@/lib/scrapers/skeleton";

// 将棋プレミアム 番組表 (Live 中継対象の補完)
// https://www.shogi-premium.jp/
export const GET = buildScraperHandler({
  siteKey: "shogi-premium",
  siteName: "将棋プレミアム 番組表",
  url: "https://www.shogi-premium.jp/",
  enabled: false,
  note: "規約確認未。NHK杯などのテレビ放送中継情報の補完用。",
});
