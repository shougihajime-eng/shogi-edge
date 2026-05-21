// =============================================================
// B層スクレイパー レジストリ
// /admin/scraper-status と各 route が同じ情報を読む単一ソース
// 有効化は Vercel ダッシュボードで envVarName を "true" にする
// =============================================================

export interface ScraperEntry {
  siteKey: string;
  envVarName: string;
  cronPath: string;
  siteName: string;
  url: string;
  purpose: string;
  priority: 1 | 2 | 3 | 4 | 99; // 99 = 永久 OFF 推奨
  termsRisk: "low" | "medium" | "high" | "blocked";
  termsRiskLabel: string;
  note: string;
}

export const SCRAPERS: ScraperEntry[] = [
  {
    siteKey: "live_shogi_or_jp",
    envVarName: "SCRAPER_LIVE_SHOGI_OR_JP_ENABLED",
    cronPath: "/api/cron/scrape-live-shogi-or-jp",
    siteName: "将棋連盟LIVE中継",
    url: "https://live.shogi.or.jp/",
    purpose: "Live中継対象の対局抽出 (必須フィルタ)",
    priority: 1,
    termsRisk: "medium",
    termsRiskLabel: "公式利用規約と robots.txt を確認後 OK なら有効化",
    note: "現在 shogi.or.jp 系がサーバ攻撃で不安定。復旧確認後に規約読み直し。",
  },
  {
    siteKey: "shogi_or_jp",
    envVarName: "SCRAPER_SHOGI_OR_JP_ENABLED",
    cronPath: "/api/cron/scrape-shogi-or-jp",
    siteName: "将棋連盟 公式 対局スケジュール",
    url: "https://www.shogi.or.jp/match/",
    purpose: "プロ公式戦の対局スケジュール",
    priority: 1,
    termsRisk: "medium",
    termsRiskLabel: "公式利用規約と robots.txt を確認後 OK なら有効化",
    note: "現在サーバ攻撃中。復旧 + 規約OK確認後。",
  },
  {
    siteKey: "player_db",
    envVarName: "SCRAPER_PLAYER_DB_ENABLED",
    cronPath: "/api/cron/scrape-player-db",
    siteName: "将棋連盟 棋士データベース",
    url: "https://www.shogi.or.jp/player/",
    purpose: "棋士プロフィール・段位・戦型 自動更新",
    priority: 2,
    termsRisk: "medium",
    termsRiskLabel: "shogi.or.jp と同一規約",
    note: "shogi_or_jp と一緒に判断。段位の自動更新で漢字ミス防止に大きく寄与。",
  },
  {
    siteKey: "shogi_premium",
    envVarName: "SCRAPER_SHOGI_PREMIUM_ENABLED",
    cronPath: "/api/cron/scrape-shogi-premium",
    siteName: "将棋プレミアム",
    url: "https://www.shogi-premium.jp/",
    purpose: "Live中継対象の補完",
    priority: 2,
    termsRisk: "medium",
    termsRiskLabel: "公式 API なし。利用規約要確認",
    note: "中継カバレッジを増やす目的。Phase 2 で検討。",
  },
  {
    siteKey: "shogidb2",
    envVarName: "SCRAPER_SHOGIDB2_ENABLED",
    cronPath: "/api/cron/scrape-shogidb2",
    siteName: "将棋DB2",
    url: "https://shogidb2.com/",
    purpose: "過去対局棋譜・対戦成績",
    priority: 3,
    termsRisk: "high",
    termsRiskLabel: "個人運営・要事前連絡",
    note: "h2h と棋譜を自動更新できると大幅に楽になる。連絡先取れたら丁寧に依頼。",
  },
  {
    siteKey: "shogi_tournaments",
    envVarName: "SCRAPER_SHOGI_TOURNAMENTS_ENABLED",
    cronPath: "/api/cron/scrape-shogi-tournaments",
    siteName: "将棋大会ナビ",
    url: "https://shogi-tournaments.vercel.app/",
    purpose: "アマ大会日程",
    priority: 3,
    termsRisk: "high",
    termsRiskLabel: "個人運営・要事前連絡",
    note: "アマタブのデータ源。連絡してから。",
  },
  {
    siteKey: "shogi_amaren",
    envVarName: "SCRAPER_SHOGI_AMAREN_ENABLED",
    cronPath: "/api/cron/scrape-shogi-amaren",
    siteName: "アマ連盟",
    url: "https://www.shogi-amaren.com/",
    purpose: "アマ棋戦結果",
    priority: 4,
    termsRisk: "medium",
    termsRiskLabel: "公式団体。規約要確認",
    note: "アマ大会の公式結果。連絡が必要かは規約次第。",
  },
  {
    siteKey: "rating_site",
    envVarName: "SCRAPER_RATING_SITE_ENABLED",
    cronPath: "/api/cron/scrape-rating-site",
    siteName: "将棋レーティングサイト",
    url: "https://shogidata.info/",
    purpose: "独自レーティング参考",
    priority: 4,
    termsRisk: "medium",
    termsRiskLabel: "規約要確認・サイト負担に注意",
    note: "自前計算と突き合わせる用途。任意。",
  },
  {
    siteKey: "floodgate",
    envVarName: "SCRAPER_FLOODGATE_ENABLED",
    cronPath: "/api/cron/scrape-floodgate",
    siteName: "floodgate (コンピュータ将棋)",
    url: "http://wdoor.c.u-tokyo.ac.jp/shogi/floodgate.html",
    purpose: "コンピュータ将棋レーティング参考",
    priority: 4,
    termsRisk: "low",
    termsRiskLabel: "学術サイト・研究用途で軽負荷なら OK",
    note: "CSA ファイル経由を優先。任意。",
  },
  {
    siteKey: "abema",
    envVarName: "SCRAPER_ABEMA_ENABLED",
    cronPath: "/api/cron/scrape-abema",
    siteName: "ABEMA将棋",
    url: "https://abema.tv/now-on-air/shogi",
    purpose: "Live中継対象の補完",
    priority: 99,
    termsRisk: "blocked",
    termsRiskLabel: "利用規約上、自動取得は明確に禁止",
    note: "規約違反になるため恒久 OFF 推奨。有効化禁止。",
  },
];

export function lookupScraper(siteKey: string): ScraperEntry | undefined {
  return SCRAPERS.find((s) => s.siteKey === siteKey);
}

export function isScraperEnabled(siteKey: string): boolean {
  const entry = lookupScraper(siteKey);
  if (!entry) return false;
  if (entry.priority === 99) return false; // ブラックリスト
  return process.env[entry.envVarName] === "true";
}
