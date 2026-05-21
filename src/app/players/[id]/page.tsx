import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";
import { PageShell } from "@/components/PageShell";
import { PlayerStatsPanel } from "@/components/PlayerStatsPanel";
import type { Player, PlayerOpening, PlayerStats, HeadToHead, Match } from "@/types/db";
import { formatDateJa } from "@/lib/utils";

export const dynamic = "force-dynamic";

const OPENING_LABEL: Record<string, string> = {
  ai_kakari: "相掛かり",
  kakugawari: "角換わり",
  yokofudori: "横歩取り",
  yagura: "矢倉",
  gangi: "雁木",
  shikenbisha: "四間飛車",
  sankenbisha: "三間飛車",
  nakabisha: "中飛車",
  mukaibisha: "向かい飛車",
  gokigen: "ゴキゲン中飛車",
  fujii_system: "藤井システム",
  other: "その他",
};

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = createServerSupabase();
  const { data: pRaw } = await sb.from("players").select("*").eq("id", id).maybeSingle();
  if (!pRaw) notFound();
  const player = pRaw as unknown as Player;

  const [{ data: statsRaw }, { data: openingsRaw }, { data: h2hRaw }, { data: upcomingRaw }] =
    await Promise.all([
      sb
        .from("player_stats")
        .select("*")
        .eq("player_id", id)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("player_openings").select("*").eq("player_id", id),
      sb
        .from("head_to_head")
        .select("*")
        .or(`player_a_id.eq.${id},player_b_id.eq.${id}`)
        .order("match_date", { ascending: false })
        .limit(20),
      sb
        .from("matches")
        .select("*")
        .or(`player_a_id.eq.${id},player_b_id.eq.${id}`)
        .gte("match_date", new Date().toISOString().slice(0, 10))
        .order("match_date", { ascending: true })
        .limit(5),
    ]);

  const stats = (statsRaw as unknown as PlayerStats) ?? null;
  const openings = ((openingsRaw ?? []) as unknown as PlayerOpening[]) ?? [];
  const h2h = ((h2hRaw ?? []) as unknown as HeadToHead[]) ?? [];
  const upcoming = ((upcomingRaw ?? []) as unknown as Match[]) ?? [];

  // 戦型集計
  const opensAgg = aggregateOpenings(openings);

  return (
    <PageShell>
      <Link
        href="/players"
        className="mb-4 inline-block text-xs text-sumi-400 hover:text-washi-100"
      >
        ← 棋士一覧へ
      </Link>
      <header className="mb-8">
        <PlayerStatsPanel player={player} stats={stats} side="left" />
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
          <h3 className="mb-3 font-serif text-lg">戦型別成績</h3>
          {opensAgg.length === 0 ? (
            <p className="text-xs text-sumi-400">登録なし</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {opensAgg.map((o) => (
                <li key={o.opening} className="flex items-center justify-between">
                  <span>{OPENING_LABEL[o.opening] ?? o.opening}</span>
                  <span className="font-num text-sumi-300 tabular-nums">
                    {o.wins}勝{o.losses}敗 {o.wins + o.losses > 0 ? `(.${((o.wins / (o.wins + o.losses)) * 1000).toFixed(0).padStart(3, "0")})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
          <h3 className="mb-3 font-serif text-lg">直近の対戦履歴 (直近20)</h3>
          {h2h.length === 0 ? (
            <p className="text-xs text-sumi-400">記録なし</p>
          ) : (
            <ul className="divide-y divide-washi-100/5 text-xs">
              {h2h.map((h) => {
                const won = h.winner_id === player.id;
                return (
                  <li key={h.id} className="flex items-center justify-between py-2">
                    <span className="font-num text-sumi-400 tabular-nums">
                      {formatDateJa(h.match_date)}
                    </span>
                    <span className={won ? "text-shu-400" : "text-ai-300"}>{won ? "勝" : "負"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5 md:col-span-2">
          <h3 className="mb-3 font-serif text-lg">今後の対局</h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-sumi-400">登録された対局なし</p>
          ) : (
            <ul className="divide-y divide-washi-100/5 text-xs">
              {upcoming.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <Link href={`/match/${m.id}`} className="hover:text-washi-100">
                    <span className="font-num tabular-nums mr-3">{formatDateJa(m.match_date)}</span>
                    <span>{m.tournament}</span>
                  </Link>
                  {m.is_live ? (
                    <span className="rounded bg-shu-500/15 px-1.5 py-0.5 text-[10px] text-shu-300">LIVE</span>
                  ) : (
                    <span className="text-[10px] text-sumi-500">中継未確認</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function aggregateOpenings(rows: PlayerOpening[]) {
  const map = new Map<string, { opening: string; wins: number; losses: number }>();
  for (const r of rows) {
    const cur = map.get(r.opening) ?? { opening: r.opening, wins: 0, losses: 0 };
    cur.wins += r.wins;
    cur.losses += r.losses;
    map.set(r.opening, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
}
