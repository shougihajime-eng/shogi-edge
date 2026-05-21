import { buildScraperHandler } from "@/lib/scrapers/skeleton";

// 将棋大会ナビ (アマ大会日程)
// https://shogi-tournaments.vercel.app/
export const GET = buildScraperHandler({
  siteKey: "shogi-tournaments",
  siteName: "将棋大会ナビ",
  url: "https://shogi-tournaments.vercel.app/",
  enabled: false,
  note: "個人運営サイト。運営者へ事前連絡 (協業の打診含む) 後に ON。",
});
