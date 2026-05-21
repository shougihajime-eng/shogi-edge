import { buildScraperHandler } from "@/lib/scrapers/skeleton";

// 将棋レーティングサイト (独自レーティング参照)
// https://shogidata.info/ など
export const GET = buildScraperHandler({
  siteKey: "rating-site",
  siteName: "将棋レーティングサイト",
  url: "https://shogidata.info/",
  enabled: false,
  note: "個人運営。事前連絡を取って許可を得てから ON にする。",
});
