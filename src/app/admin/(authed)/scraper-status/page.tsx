export const dynamic = "force-dynamic";

const sources = [
  {
    name: "日本将棋連盟 公式 対局スケジュール",
    url: "https://www.shogi.or.jp/match/",
    purpose: "プロ公式戦スケジュール",
    enabled: false,
    note: "現在サーバ攻撃で不安定。復旧確認後に有効化判断。利用規約も別途確認要。",
  },
  {
    name: "将棋連盟 LIVE 中継",
    url: "https://live.shogi.or.jp/",
    purpose: "Live 中継対象抽出 (必須フィルタ)",
    enabled: false,
    note: "同上",
  },
  {
    name: "ABEMA 将棋",
    url: "https://abema.tv/now-on-air/shogi",
    purpose: "Live 中継対象の補完",
    enabled: false,
    note: "ABEMA 利用規約上、自動取得は原則禁止。手動入力ファースト。",
  },
  {
    name: "将棋プレミアム",
    url: "https://www.shogi-premium.jp/",
    purpose: "Live 中継対象の補完",
    enabled: false,
    note: "公式 API 無し。",
  },
  {
    name: "将棋DB2",
    url: "https://shogidb2.com/",
    purpose: "過去対局棋譜・対戦成績",
    enabled: false,
    note: "個人運営。事前連絡推奨。",
  },
  {
    name: "将棋連盟 棋士データベース",
    url: "https://www.shogi.or.jp/player/",
    purpose: "棋士プロフィール・段位・戦型",
    enabled: false,
    note: "同 shogi.or.jp。復旧確認後に有効化判断。",
  },
  {
    name: "将棋大会ナビ",
    url: "https://shogi-tournaments.vercel.app/",
    purpose: "アマ大会日程",
    enabled: false,
    note: "個人運営。事前連絡推奨。",
  },
  {
    name: "アマ連盟",
    url: "https://www.shogi-amaren.com/",
    purpose: "アマ棋戦結果",
    enabled: false,
    note: "規約確認中",
  },
];

export default function ScraperStatusPage() {
  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">自動取得 (B層) 状況</h1>
      <p className="mb-8 text-xs text-sumi-300">
        外部サイトからの自動取得は全 OFF で出荷しています。各サイトの規約確認が取れたものから 1 つずつ有効化していく方針です。
      </p>

      <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
        {sources.map((s) => (
          <li key={s.name} className="px-5 py-4">
            <div className="mb-1 flex items-center justify-between">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="font-name text-base hover:text-shu-400"
              >
                {s.name} ↗
              </a>
              <span
                className={
                  s.enabled
                    ? "rounded bg-shu-500/15 px-2 py-0.5 text-[10px] text-shu-300"
                    : "rounded bg-sumi-800 px-2 py-0.5 text-[10px] text-sumi-400"
                }
              >
                {s.enabled ? "ON" : "OFF"}
              </span>
            </div>
            <p className="text-xs text-sumi-300">{s.purpose}</p>
            <p className="mt-1 text-[11px] text-sumi-500">{s.note}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[11px] text-sumi-500">
        有効化は API 経由ではなく、コード(`src/app/api/cron/`)の `ENABLED` フラグを書き換えてデプロイする運用です(誤起動防止)。
      </p>
    </>
  );
}
