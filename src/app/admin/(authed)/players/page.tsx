import { createServerSupabase } from "@/lib/supabase/client";
import { createPlayer, deletePlayer } from "@/app/admin/actions";
import type { Player } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminPlayers() {
  const sb = createServerSupabase();
  const { data } = await sb.from("players").select("*").order("rating", { ascending: false });
  const players = (data ?? []) as unknown as Player[];

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-6">棋士の登録・編集</h1>

      <section className="mb-10 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-4 font-serif text-lg">新規追加</h2>
        <form action={createPlayer} className="grid gap-3 md:grid-cols-3">
          <input
            name="name"
            required
            placeholder="名前 例: 藤井聡太"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <input
            name="kanji_name"
            placeholder="漢字フルネーム (省略可)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <input
            name="rank"
            defaultValue="四段"
            placeholder="段位"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <select
            name="region"
            defaultValue=""
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">所属(任意)</option>
            <option value="tokyo">東京</option>
            <option value="kansai">関西</option>
          </select>
          <input
            name="rating"
            type="number"
            step="1"
            defaultValue="1500"
            placeholder="レーティング初期値"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm font-num"
          />
          <input
            name="master"
            placeholder="師匠 (任意)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <textarea
            name="notes"
            placeholder="メモ (任意)"
            rows={2}
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm md:col-span-3"
          />
          <button
            type="submit"
            className="rounded-lg bg-shu-500 px-4 py-2 text-sm font-medium hover:bg-shu-600 md:col-span-3"
          >
            追加する
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-lg">登録済み ({players.length}名)</h2>
        {players.length === 0 ? (
          <p className="text-sm text-sumi-400">まだ登録がありません。</p>
        ) : (
          <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <span className="font-name text-lg">{p.name}</span>
                  <span className="ml-3 text-xs text-sumi-400">{p.rank}</span>
                  <span className="ml-2 text-xs font-num text-sumi-300">R{p.rating.toFixed(0)}</span>
                </div>
                <form action={deletePlayer}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-[11px] text-sumi-500 hover:text-shu-400">削除</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
