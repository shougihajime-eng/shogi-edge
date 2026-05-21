import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabase } from "@/lib/supabase/client";
import { runWikiSyncNow } from "./actions";

export const dynamic = "force-dynamic";

interface WikiSyncLogRow {
  id: string;
  source: string;
  source_url: string | null;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "partial" | "error";
  players_created: number;
  players_updated: number;
  players_skipped: number;
  error_message: string | null;
  detail_json:
    | {
        total_extracted?: number;
        active_extracted?: number;
        warnings?: string[];
        sample_changes?: string[];
      }
    | null;
}

function formatJst(iso: string | null): string {
  if (!iso) return "(走行中)";
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: WikiSyncLogRow["status"] }) {
  const cls =
    status === "ok"
      ? "bg-kincha-500/15 text-kincha-300"
      : status === "partial"
        ? "bg-shu-500/15 text-shu-300"
        : status === "error"
          ? "bg-red-500/15 text-red-300"
          : "bg-sumi-700 text-sumi-300";
  const label =
    status === "ok"
      ? "成功"
      : status === "partial"
        ? "一部成功"
        : status === "error"
          ? "失敗"
          : "走行中";
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>
  );
}

export default async function WikiSyncPage() {
  await requireAdmin();
  const sb = createServerSupabase();
  const { data: logs } = await sb
    .from("wiki_sync_logs")
    .select(
      "id, source, source_url, started_at, finished_at, status, players_created, players_updated, players_skipped, error_message, detail_json",
    )
    .order("started_at", { ascending: false })
    .limit(20);

  const last = (logs ?? [])[0] as WikiSyncLogRow | undefined;

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">Wikipedia 自動同期</h1>
      <p className="mb-8 text-xs text-sumi-300">
        日本語版ウィキペディアの「
        <a
          href="https://ja.wikipedia.org/wiki/%E5%B0%86%E6%A3%8B%E6%A3%8B%E5%A3%AB%E4%B8%80%E8%A6%A7"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-shu-400"
        >
          将棋棋士一覧
        </a>
        」から、現役棋士の段位・出身・師匠・生年月日を取り込みます。Wikipedia 本文は{" "}
        <strong>CC-BY-SA 3.0</strong> ライセンスで配布されており、出典明記の上で再利用可能です。
      </p>

      {/* スケジュール案内 */}
      <section className="mb-6 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-5">
        <h2 className="mb-2 text-[11px] uppercase tracking-widest text-sumi-400">
          自動スケジュール
        </h2>
        <p className="text-sm text-washi-100">
          毎週 月曜 03:00 JST に自動で同期 (vercel.json の crons より)
        </p>
        <p className="mt-1 text-[11px] text-sumi-500">
          手動で走らせたい時は下のボタン。連続実行はできるが Wikipedia への負荷を考えて 1 日に何度も叩かないこと。
        </p>
      </section>

      {/* 手動実行 */}
      <section className="mb-8 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-5">
        <h2 className="mb-2 font-serif text-lg">いますぐ同期する</h2>
        <p className="mb-3 text-[11px] text-sumi-500">
          数秒〜十数秒かかります。完了するとこのページにログが追加されます。
        </p>
        <form action={runWikiSyncNow}>
          <button
            type="submit"
            className="rounded-lg bg-shu-500 px-4 py-2 text-sm font-semibold text-washi-100 transition-colors hover:bg-shu-400"
          >
            手動で実行
          </button>
        </form>
      </section>

      {/* 最新サマリー */}
      {last && (
        <section className="mb-8 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-5">
          <h2 className="mb-3 text-[11px] uppercase tracking-widest text-sumi-400">
            直近の実行サマリー
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="抽出した総人数" value={last.detail_json?.total_extracted ?? 0} />
            <Stat label="うち現役" value={last.detail_json?.active_extracted ?? 0} />
            <Stat label="新規登録" value={last.players_created} accent="add" />
            <Stat label="更新した棋士" value={last.players_updated} />
          </div>
          {last.detail_json?.sample_changes &&
            last.detail_json.sample_changes.length > 0 && (
              <details className="mt-4 text-xs text-sumi-300">
                <summary className="cursor-pointer hover:text-washi-100">
                  実際の変更内容 (一部表示)
                </summary>
                <ul className="mt-2 ml-5 list-disc space-y-1">
                  {last.detail_json.sample_changes.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </details>
            )}
          {last.detail_json?.warnings &&
            last.detail_json.warnings.length > 0 && (
              <details className="mt-3 text-xs text-shu-300">
                <summary className="cursor-pointer">警告 {last.detail_json.warnings.length}件</summary>
                <ul className="mt-2 ml-5 list-disc space-y-1">
                  {last.detail_json.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
        </section>
      )}

      {/* 履歴一覧 */}
      <section>
        <h2 className="mb-3 font-serif text-lg">実行履歴</h2>
        {(!logs || logs.length === 0) && (
          <p className="text-sm text-sumi-400">
            まだ実行されていません。上のボタンで一度実行してみてください。
          </p>
        )}
        <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
          {(logs as WikiSyncLogRow[] | null)?.map((log) => (
            <li key={log.id} className="px-5 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-num text-xs tabular-nums text-sumi-300">
                  {formatJst(log.started_at)}
                </span>
                <StatusBadge status={log.status} />
              </div>
              <p className="mt-1 text-[11px] text-sumi-400">
                新規 <span className="text-kincha-400">{log.players_created}</span> /
                更新 <span className="text-washi-100">{log.players_updated}</span> /
                スキップ <span className="text-shu-300">{log.players_skipped}</span>
              </p>
              {log.error_message && (
                <p className="mt-1 text-[11px] text-red-300">
                  エラー: {log.error_message}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "add";
}) {
  return (
    <div className="rounded-lg bg-sumi-950 p-3">
      <p className="text-[10px] uppercase tracking-widest text-sumi-400">{label}</p>
      <p
        className={`mt-1 font-num text-2xl tabular-nums ${
          accent === "add" ? "text-kincha-300" : "text-washi-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
