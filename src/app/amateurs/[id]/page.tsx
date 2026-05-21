import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";
import { PageShell } from "@/components/PageShell";
import type { Amateur } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AmateurDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = createServerSupabase();
  const { data } = await sb.from("amateurs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as unknown as Amateur;

  return (
    <PageShell>
      <Link href="/amateurs" className="mb-4 inline-block text-xs text-sumi-400 hover:text-washi-100">
        ← アマ選手一覧
      </Link>
      <h1 className="font-name text-3xl md:text-4xl font-semibold">{a.name}</h1>
      <p className="mt-2 text-xs text-sumi-400">
        {a.ama_rank ?? "段位未登録"}
        {a.age ? ` / ${a.age}歳` : ""}
        {a.branch ? ` / ${a.branch}` : ""}
      </p>
      {a.is_ex_shoreikai ? (
        <span className="mt-3 inline-block rounded bg-kincha-500/15 px-2 py-0.5 text-[11px] text-kincha-400">
          元奨励会員
        </span>
      ) : null}
      {a.notes ? (
        <section className="mt-6 rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
          <h3 className="mb-2 font-serif text-lg">メモ</h3>
          <p className="text-xs leading-relaxed text-sumi-200 whitespace-pre-wrap">{a.notes}</p>
        </section>
      ) : null}
      <p className="mt-8 text-[11px] text-sumi-500">
        ※ アマ選手データは公開された大会結果のみ。削除依頼は管理画面から対応します。
      </p>
    </PageShell>
  );
}
