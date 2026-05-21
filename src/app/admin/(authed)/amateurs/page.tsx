import { createServerSupabase } from "@/lib/supabase/client";
import { createAmateur, deleteAmateur } from "@/app/admin/actions";
import type { Amateur } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminAmateurs() {
  const sb = createServerSupabase();
  const { data } = await sb.from("amateurs").select("*").order("name", { ascending: true });
  const amateurs = (data ?? []) as unknown as Amateur[];

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-6">アマ選手の登録</h1>

      <section className="mb-10 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-4 font-serif text-lg">新規追加</h2>
        <form action={createAmateur} className="grid gap-3 md:grid-cols-3">
          <input
            name="name"
            required
            placeholder="名前"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <input
            name="age"
            type="number"
            placeholder="年齢 (任意)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm font-num"
          />
          <input
            name="branch"
            placeholder="所属支部 (任意)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <input
            name="ama_rank"
            placeholder="アマ段位 例: 七段"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 px-3 py-2 text-sm">
            <input type="checkbox" name="is_ex_shoreikai" />
            <span>元奨励会員</span>
          </label>
          <textarea
            name="notes"
            placeholder="メモ"
            rows={2}
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm md:col-span-3"
          />
          <button
            type="submit"
            className="rounded-lg bg-shu-500 px-4 py-2 text-sm font-medium hover:bg-shu-600 md:col-span-3"
          >
            追加
          </button>
        </form>
      </section>

      <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
        {amateurs.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <span className="font-name text-lg">{a.name}</span>
              {a.ama_rank ? <span className="ml-3 text-xs text-sumi-400">{a.ama_rank}</span> : null}
              {a.is_ex_shoreikai ? (
                <span className="ml-2 rounded bg-kincha-500/15 px-1.5 py-0.5 text-[10px] text-kincha-400">
                  元奨励会
                </span>
              ) : null}
            </div>
            <form action={deleteAmateur}>
              <input type="hidden" name="id" value={a.id} />
              <button className="text-[11px] text-sumi-500 hover:text-shu-400">削除</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
