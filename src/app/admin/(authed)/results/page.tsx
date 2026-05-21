import { createServerSupabase } from "@/lib/supabase/client";
import { finalizeResult } from "@/app/admin/actions";
import { formatDateJa } from "@/lib/utils";
import type { Match, Player } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminResults() {
  const sb = createServerSupabase();
  const [{ data: pData }, { data: mData }] = await Promise.all([
    sb.from("players").select("*"),
    sb
      .from("matches")
      .select("*")
      .in("status", ["scheduled", "ongoing", "finished"])
      .order("match_date", { ascending: false })
      .limit(50),
  ]);
  const players = (pData ?? []) as unknown as Player[];
  const matches = (mData ?? []) as unknown as Match[];
  const pmap = new Map(players.map((p) => [p.id, p]));

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">結果確定</h1>
      <p className="mb-8 text-xs text-sumi-300">
        終局後、勝者を選択すると的中/外れが自動記録され、予想精度トラッキングに反映されます。
      </p>

      <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
        {matches.map((m) => {
          const a = pmap.get(m.player_a_id);
          const b = pmap.get(m.player_b_id);
          if (!a || !b) return null;
          return (
            <li key={m.id} className="px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="font-num text-xs text-sumi-400 tabular-nums">
                    {formatDateJa(m.match_date)}
                  </span>
                  <span className="ml-3 text-sm">{m.tournament}</span>
                </div>
                {m.status === "finished" && m.result_winner_id ? (
                  <span className="rounded bg-kincha-500/15 px-2 py-0.5 text-[11px] text-kincha-400">
                    確定: {pmap.get(m.result_winner_id)?.name ?? "?"} 勝
                  </span>
                ) : null}
              </div>
              <form action={finalizeResult} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="match_id" value={m.id} />
                <select
                  name="winner_id"
                  required
                  className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
                  defaultValue={m.result_winner_id ?? ""}
                >
                  <option value="">勝者を選択...</option>
                  <option value={a.id}>{a.name}</option>
                  <option value={b.id}>{b.name}</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-shu-500 px-3 py-2 text-xs font-medium hover:bg-shu-600"
                >
                  確定
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      {matches.length === 0 ? (
        <p className="text-sm text-sumi-400">対象の対局がありません。</p>
      ) : null}
    </>
  );
}
