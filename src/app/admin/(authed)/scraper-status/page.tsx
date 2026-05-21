import Link from "next/link";
import { SCRAPERS, type ScraperEntry } from "@/lib/scrapers/registry";

export const dynamic = "force-dynamic";

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "P1 最優先", color: "bg-shu-500/15 text-shu-300" },
  2: { label: "P2 次に", color: "bg-kincha-500/15 text-kincha-400" },
  3: { label: "P3 連絡必要", color: "bg-ai-500/15 text-ai-300" },
  4: { label: "P4 任意", color: "bg-sumi-700 text-sumi-200" },
  99: { label: "❌ 永久OFF", color: "bg-sumi-800 text-sumi-400" },
};

const RISK_LABEL: Record<string, { label: string; color: string }> = {
  low: { label: "規約リスク低", color: "text-kincha-400" },
  medium: { label: "規約リスク中", color: "text-sumi-200" },
  high: { label: "規約リスク高", color: "text-shu-300" },
  blocked: { label: "規約NG", color: "text-shu-500" },
};

export default function ScraperStatusPage() {
  const sorted = [...SCRAPERS].sort((a, b) => a.priority - b.priority);
  const byPriority = new Map<number, ScraperEntry[]>();
  for (const s of sorted) {
    if (!byPriority.has(s.priority)) byPriority.set(s.priority, []);
    byPriority.get(s.priority)!.push(s);
  }

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">自動取得 (B層) 状況</h1>
      <p className="mb-6 text-xs text-sumi-300">
        全スクレイパーは <strong>OFF</strong> がデフォルト。Vercel ダッシュボードで{" "}
        <code className="text-shu-300">SCRAPER_xxx_ENABLED=true</code> を追加すると有効化できます (詳細手順は{" "}
        <Link href="/docs/scraper-enablement-plan" className="underline hover:text-washi-100">
          手順書
        </Link>
        )。
      </p>

      <section className="mb-6 rounded-2xl border border-kincha-500/30 bg-kincha-500/5 p-5">
        <h2 className="mb-2 font-serif text-lg text-kincha-300">
          ✅ 代替: Wikipedia 自動同期 (毎週稼働中)
        </h2>
        <p className="text-xs text-washi-200">
          下記の B層は規約 OFF のままですが、
          <strong>
            <Link href="/admin/wiki-sync" className="underline hover:text-kincha-200">
              Wikipedia 同期 (CC-BY-SA で合法)
            </Link>
          </strong>{" "}
          が毎週月曜 03:00 JST に走っており、現役棋士の段位・出身・師匠・生年月日を最新化しています。
        </p>
      </section>

      <section className="mb-8 rounded-2xl border border-shu-500/30 bg-shu-500/5 p-5">
        <h2 className="mb-2 font-serif text-lg">📋 推奨順序 (1サイトずつ確認しながら)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-washi-200">
          <li>
            <strong>連盟サイト復旧確認</strong>(普通にブラウザで{" "}
            <a
              href="https://www.shogi.or.jp/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-shu-300"
            >
              shogi.or.jp
            </a>{" "}
            が開けるか)
          </li>
          <li>
            <strong>P1</strong> の 2 サイト (LIVE中継 / 公式) を規約確認 → OK なら有効化
          </li>
          <li>1週間運用してエラーが出ないか・データが取れているか監視</li>
          <li>
            <strong>P2</strong> (棋士DB / 将棋プレミアム) を順次有効化
          </li>
          <li>
            <strong>P3</strong> の個人運営サイトには事前連絡してから
          </li>
        </ol>
      </section>

      {Array.from(byPriority.entries()).map(([priority, entries]) => (
        <section key={priority} className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-lg">
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${PRIORITY_LABEL[priority].color}`}
            >
              {PRIORITY_LABEL[priority].label}
            </span>
            <span className="text-sumi-400 text-xs">{entries.length} サイト</span>
          </h2>
          <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
            {entries.map((s) => (
              <ScraperRow key={s.siteKey} entry={s} />
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-5">
        <h2 className="mb-2 font-serif text-lg">🛠 有効化の手順 (再掲)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-sumi-200">
          <li>
            上の表で対象サイトの規約を確認 (個人運営は連絡してから)
          </li>
          <li>
            <a
              href="https://vercel.com/shougihajime-3368s-projects/shogi-edge/settings/environment-variables"
              target="_blank"
              rel="noreferrer"
              className="text-shu-300 underline hover:text-shu-200"
            >
              Vercel 環境変数ページ ↗
            </a>{" "}
            で「Add New」をクリック
          </li>
          <li>
            上の表の「環境変数名」欄をコピペで Name に貼り付け / Value に{" "}
            <code className="text-kincha-400">true</code>
          </li>
          <li>Environments で「Production」にチェック → Save</li>
          <li>
            <a
              href="https://vercel.com/shougihajime-3368s-projects/shogi-edge/deployments"
              target="_blank"
              rel="noreferrer"
              className="text-shu-300 underline hover:text-shu-200"
            >
              Deployments ↗
            </a>{" "}
            で最新本番デプロイの ⋯ メニューから「Redeploy」
          </li>
          <li>30秒後、このページを再読み込みして該当行が「ON」(朱色) になっているか確認</li>
        </ol>
      </section>
    </>
  );
}

function ScraperRow({ entry }: { entry: ScraperEntry }) {
  const enabled =
    entry.priority !== 99 && process.env[entry.envVarName] === "true";
  const risk = RISK_LABEL[entry.termsRisk];

  return (
    <li className="px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="font-name text-base hover:text-shu-400"
        >
          {entry.siteName} ↗
        </a>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${risk.color}`}>{risk.label}</span>
          <span
            className={
              enabled
                ? "rounded bg-shu-500/20 px-2 py-0.5 text-[11px] font-medium text-shu-300"
                : entry.priority === 99
                  ? "rounded bg-sumi-800 px-2 py-0.5 text-[11px] text-sumi-500"
                  : "rounded bg-sumi-800 px-2 py-0.5 text-[11px] text-sumi-400"
            }
          >
            {enabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>
      <p className="mb-1 text-xs text-sumi-200">
        <span className="text-[10px] uppercase tracking-widest text-sumi-500 mr-2">用途</span>
        {entry.purpose}
      </p>
      <p className="mb-2 text-[11px] text-sumi-400">{entry.note}</p>
      <details className="text-[11px]">
        <summary className="cursor-pointer text-sumi-300 hover:text-washi-100">
          有効化に必要な情報
        </summary>
        <dl className="mt-2 grid grid-cols-[120px_1fr] gap-y-1 text-[11px]">
          <dt className="text-sumi-500">環境変数名</dt>
          <dd>
            <code className="rounded bg-sumi-950 px-1.5 py-0.5 text-kincha-400">
              {entry.envVarName}
            </code>
          </dd>
          <dt className="text-sumi-500">cron path</dt>
          <dd>
            <code className="text-washi-200">{entry.cronPath}</code>
          </dd>
          <dt className="text-sumi-500">規約チェック</dt>
          <dd className="text-sumi-200">{entry.termsRiskLabel}</dd>
        </dl>
      </details>
    </li>
  );
}
