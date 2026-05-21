import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  const sb = createServerSupabase();
  const [
    { count: playerCount },
    { count: matchCount },
    { count: predCount },
    { count: h2hCount },
    { count: amaCount },
  ] = await Promise.all([
    sb.from("players").select("*", { count: "exact", head: true }),
    sb.from("matches").select("*", { count: "exact", head: true }),
    sb.from("predictions").select("*", { count: "exact", head: true }),
    sb.from("head_to_head").select("*", { count: "exact", head: true }),
    sb.from("amateurs").select("*", { count: "exact", head: true }),
  ]);

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-8">ダッシュボード</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="棋士" value={playerCount ?? 0} href="/admin/players" />
        <Stat label="対局" value={matchCount ?? 0} href="/admin/matches" />
        <Stat label="予想" value={predCount ?? 0} href="/accuracy" />
        <Stat label="直接対戦" value={h2hCount ?? 0} href="/admin/head-to-head" />
        <Stat label="アマ選手" value={amaCount ?? 0} href="/admin/amateurs" />
      </div>

      <section className="mt-10 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-3 font-serif text-lg">最初にやることのおすすめ手順</h2>
        <ol className="list-decimal space-y-2 pl-6 text-sm text-sumi-200">
          <li>
            <Link href="/admin/players" className="underline hover:text-washi-100">
              棋士
            </Link>
            …予想したい対局者を登録 (名前・段位・レーティング初期値)
          </li>
          <li>
            <Link href="/admin/player-stats" className="underline hover:text-washi-100">
              成績入力
            </Link>
            …直近1ヶ月・通算・先手後手別の数字を入力
          </li>
          <li>
            <Link href="/admin/head-to-head" className="underline hover:text-washi-100">
              直接対戦
            </Link>
            …過去の対戦を登録 (重要・信頼度に直結)
          </li>
          <li>
            <Link href="/admin/matches" className="underline hover:text-washi-100">
              対局
            </Link>
            …予定の対局を登録 → 「Live中継ON」+「予想を生成」をクリック
          </li>
          <li>
            終局後{" "}
            <Link href="/admin/results" className="underline hover:text-washi-100">
              結果確定
            </Link>
            …勝者を入力すると的中/外れが自動記録
          </li>
        </ol>
      </section>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-4 transition-colors hover:bg-sumi-800/60"
    >
      <p className="text-[10px] uppercase tracking-widest text-sumi-400">{label}</p>
      <p className="mt-1 font-num text-3xl font-bold tabular-nums">{value}</p>
    </Link>
  );
}
