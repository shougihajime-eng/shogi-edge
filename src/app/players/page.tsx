import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";
import { PageShell } from "@/components/PageShell";
import type { Player } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PlayersIndex() {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("players")
    .select("*")
    .order("rating", { ascending: false });
  const players = (data ?? []) as unknown as Player[];

  return (
    <PageShell>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-shu-400">players</p>
          <h1 className="font-serif text-3xl font-bold">棋士一覧</h1>
          <p className="mt-2 text-xs text-sumi-300">
            登録済み棋士 {players.length} 名 (レーティング降順)
          </p>
        </div>
        <Link
          href="/admin/players"
          className="rounded-lg border border-washi-100/10 px-3 py-1.5 text-xs hover:bg-sumi-800"
        >
          管理画面で追加
        </Link>
      </header>

      {error ? (
        <div className="rounded-lg border border-shu-500/30 bg-shu-500/10 p-4 text-sm text-shu-300">
          {error.message}
        </div>
      ) : players.length === 0 ? (
        <p className="text-sm text-sumi-400">棋士が未登録です。管理画面から登録してください。</p>
      ) : (
        <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/60">
          {players.map((p) => (
            <li key={p.id}>
              <Link
                href={`/players/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-sumi-800/60"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-name text-xl font-semibold">{p.name}</span>
                  <span className="text-xs text-sumi-400">{p.rank}</span>
                  {p.region ? (
                    <span className="text-[10px] uppercase tracking-wider text-sumi-500">
                      {p.region === "tokyo" ? "東京" : "関西"}
                    </span>
                  ) : null}
                </div>
                <span className="font-num font-medium tabular-nums">R{p.rating.toFixed(0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
