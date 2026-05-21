import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";
import { createMatch, updateMatchLive, deleteMatch, regenerate } from "@/app/admin/actions";
import { formatDateJa } from "@/lib/utils";
import type { Match, Player } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminMatches() {
  const sb = createServerSupabase();
  const [{ data: pData }, { data: mData }] = await Promise.all([
    sb.from("players").select("*").order("name", { ascending: true }),
    sb
      .from("matches")
      .select("*")
      .order("match_date", { ascending: false })
      .limit(100),
  ]);
  const players = (pData ?? []) as unknown as Player[];
  const matches = (mData ?? []) as unknown as Match[];
  const pmap = new Map(players.map((p) => [p.id, p]));

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">対局の登録</h1>
      <p className="mb-8 text-xs text-sumi-300">
        Live 中継対象のみがトップに表示されます。中継URLを 1 つでも登録すれば自動で「Live 中継ON」にできます。
      </p>

      <section className="mb-10 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-4 font-serif text-lg">新規追加</h2>
        <form action={createMatch} className="grid gap-3 md:grid-cols-3">
          <input
            name="match_date"
            type="date"
            required
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <input
            name="match_time"
            type="time"
            placeholder="開始時刻 (任意)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <input
            name="tournament"
            placeholder="棋戦名 例: 竜王戦本戦"
            required
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />

          <select
            name="player_a_id"
            required
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">対局者 A...</option>
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
            <option value="">対局者 B...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="sente_id"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">先手 (未確定可)</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            name="time_control"
            defaultValue="one_day"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="long">長時間 (タイトル戦)</option>
            <option value="one_day">一日制</option>
            <option value="fast">早指し</option>
            <option value="ultra_fast">超早指し</option>
          </select>
          <label className="flex items-center gap-2 px-3 py-2 text-sm">
            <input type="checkbox" name="is_live" />
            <span>Live 中継 ON</span>
          </label>
          <label className="flex items-center gap-2 px-3 py-2 text-sm">
            <input type="checkbox" name="is_amateur" />
            <span>アマ対局</span>
          </label>

          <input
            name="live_url_shogi_or_jp"
            placeholder="連盟LIVE URL (任意)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm md:col-span-3"
          />
          <input
            name="live_url_abema"
            placeholder="ABEMA URL (任意)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm md:col-span-3"
          />
          <input
            name="live_url_premium"
            placeholder="将棋プレミアム URL (任意)"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm md:col-span-3"
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
            追加
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-lg">登録済み (直近100件)</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-sumi-400">まだ対局がありません。</p>
        ) : (
          <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
            {matches.map((m) => {
              const a = pmap.get(m.player_a_id);
              const b = pmap.get(m.player_b_id);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <span className="font-num text-xs text-sumi-400 tabular-nums">
                      {formatDateJa(m.match_date)} {m.match_time ?? ""}
                    </span>
                    <span className="ml-3 text-sm">{m.tournament}</span>
                    <div className="text-xs text-sumi-200">
                      <span className="font-name">{a?.name ?? "?"}</span>
                      <span className="mx-1 text-sumi-500">vs</span>
                      <span className="font-name">{b?.name ?? "?"}</span>
                      {m.is_amateur ? (
                        <span className="ml-2 rounded bg-kincha-500/15 px-1 py-0.5 text-[10px] text-kincha-400">
                          アマ
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={updateMatchLive}>
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        name="is_live"
                        value={m.is_live ? "off" : "on"}
                        className={
                          m.is_live
                            ? "rounded-md border border-shu-500/40 bg-shu-500/10 px-2 py-1 text-[11px] text-shu-300 hover:bg-shu-500/20"
                            : "rounded-md border border-washi-100/10 bg-sumi-900 px-2 py-1 text-[11px] text-sumi-300 hover:bg-sumi-800"
                        }
                      >
                        {m.is_live ? "LIVE ON" : "LIVE OFF"}
                      </button>
                    </form>
                    <form action={regenerate}>
                      <input type="hidden" name="match_id" value={m.id} />
                      <button className="rounded-md border border-shu-500/30 bg-shu-500/10 px-2 py-1 text-[11px] text-shu-300 hover:bg-shu-500/20">
                        予想を生成
                      </button>
                    </form>
                    <Link
                      href={`/match/${m.id}`}
                      className="rounded-md border border-washi-100/10 px-2 py-1 text-[11px] hover:bg-sumi-800"
                    >
                      表示
                    </Link>
                    <form action={deleteMatch}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="text-[10px] text-sumi-500 hover:text-shu-400">削除</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
