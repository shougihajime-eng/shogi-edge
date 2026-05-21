import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";
import { PageShell } from "@/components/PageShell";
import type { Amateur } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AmateursIndex() {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("amateurs")
    .select("*")
    .order("name", { ascending: true });
  const amateurs = (data ?? []) as unknown as Amateur[];

  return (
    <PageShell>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-shu-400">amateurs</p>
          <h1 className="font-serif text-3xl font-bold">アマ選手一覧</h1>
          <p className="mt-2 text-xs text-sumi-300">
            登録 {amateurs.length} 名 (アマ大会公開情報のみ)
          </p>
        </div>
        <Link
          href="/admin/amateurs"
          className="rounded-lg border border-washi-100/10 px-3 py-1.5 text-xs hover:bg-sumi-800"
        >
          管理画面で追加
        </Link>
      </header>

      {amateurs.length === 0 ? (
        <p className="text-sm text-sumi-400">
          アマ選手が未登録です。
          <Link href="/admin/amateurs" className="underline hover:text-washi-100">
            管理画面から登録
          </Link>
          してください。
        </p>
      ) : (
        <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/60">
          {amateurs.map((a) => (
            <li key={a.id}>
              <Link
                href={`/amateurs/${a.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sumi-800/60"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-name text-xl font-semibold">{a.name}</span>
                  {a.ama_rank ? <span className="text-xs text-sumi-400">{a.ama_rank}</span> : null}
                  {a.is_ex_shoreikai ? (
                    <span className="rounded bg-kincha-500/15 px-1.5 py-0.5 text-[10px] text-kincha-400">
                      元奨励会
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-sumi-400">
                  {a.age ? `${a.age}歳` : ""} {a.branch ? `/ ${a.branch}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
