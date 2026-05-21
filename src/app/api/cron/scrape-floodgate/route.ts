import { buildScraperHandler } from "@/lib/scrapers/skeleton";

// floodgate (コンピュータ将棋) — レーティング参考用
// http://wdoor.c.u-tokyo.ac.jp/shogi/floodgate.html
export const GET = buildScraperHandler({
  siteKey: "floodgate",
  siteName: "floodgate コンピュータ将棋",
  url: "http://wdoor.c.u-tokyo.ac.jp/shogi/floodgate.html",
  enabled: false,
  note: "学術サイト。研究用途であれば負担をかけない範囲で OK の見込み。CSA ファイル経由を優先。",
});
