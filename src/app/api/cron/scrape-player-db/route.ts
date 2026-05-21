import { buildScraperHandler } from "@/lib/scrapers/skeleton";

// 将棋連盟 棋士データベース (棋士プロフィール・段位・戦型)
// https://www.shogi.or.jp/player/
export const GET = buildScraperHandler({
  siteKey: "player-db",
  siteName: "日本将棋連盟 棋士データベース",
  url: "https://www.shogi.or.jp/player/",
  enabled: false,
  note: "連盟公式。利用規約 + 中村太地八段の漢字表記の絶対正を確認した上で ON。",
});
