import { createServerSupabase } from "@/lib/supabase/client";
import { addHeadToHead, deleteHeadToHead } from "@/app/admin/actions";
import { formatDateJa } from "@/lib/utils";
import type { HeadToHead, Player } from "@/types/db";

export const dynamic = "force-dynamic";

const OPENINGS = [
  ["", "未指定"],
  ["ai_kakari", "相掛かり"],
  ["kakugawari", "角換わり"],
  ["yokofudori", "横歩取り"],
  ["yagura", "矢倉"],
  ["gangi", "雁木"],
  ["shikenbisha", "四間飛車"],
  ["sankenbisha", "三間飛車"],
  ["nakabisha", "中飛車"],
  ["mukaibisha", "向かい飛車"],
  ["gokigen", "ゴキゲン中飛車"],
  ["fujii_system", "藤井システム"],
  ["other", "その他"],
] as const;

export default async function AdminHeadToHead() {
  const sb = createServerSupabase();
  const [{ data: pData }, { data: hData }] = await Promise.all([
    sb.from("players").select("*").order("name", { ascending: true }),
    sb
      .from("head_to_head")
      .select("*")
      .order("match_date", { ascending: false })
      .limit(100),
  ]);
  const players = (pData ?? []) as unknown as Player[];
  const rows = (hData ?? []) as unknown as HeadToHead[];
  const pmap = new Map(players.map((p) => [p.id, p]));

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">直接対戦履歴の登録</h1>
      <p className="mb-8 text-xs text-sumi-300">
        過去の対戦結果を入れるほど予想の信頼度が上がります。最低でも各カードで3〜5局推奨。
      </p>

      <section className="mb-10 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-4 font-serif text-lg">追加</h2>
        <form action={addHeadToHead} className="grid gap-3 md:grid-cols-3">
          <select
            name="player_a_id"
            required
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">先手 (player A)...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="player_b_id"
            required
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">後手 (player B)...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            name="match_date"
            type="date"
            required
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <input
            name="tournament"
            placeholder="棋戦 (任意)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <select
            name="opening"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            {OPENINGS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="winner_id"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">勝者...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            name="kifu_url"
            placeholder="棋譜URL (任意)"
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

      <section>
        <h2 className="mb-4 font-serif text-lg">直近100件</h2>
        <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
          {rows.map((r) => {
            const a = pmap.get(r.player_a_id);
            const b = pmap.get(r.player_b_id);
            const w = r.winner_id ? pmap.get(r.winner_id) : null;
            if (!a || !b) return null;
            return (
              <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div>
                  <span className="font-num text-sumi-400 tabular-nums">
                    {formatDateJa(r.match_date)}
                  </span>
                  <span className="ml-3 font-name">{a.name}</span>
                  <span className="mx-2 text-sumi-500">vs</span>
                  <span className="font-name">{b.name}</span>
                  {r.tournament ? (
                    <span className="ml-3 text-xs text-sumi-400">{r.tournament}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  {w ? (
                    <span className="text-xs text-kincha-400">{w.name} 勝</span>
                  ) : (
                    <span className="text-xs text-sumi-500">勝者未登録</span>
                  )}
                  <form action={deleteHeadToHead}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-[10px] text-sumi-500 hover:text-shu-400">削除</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
