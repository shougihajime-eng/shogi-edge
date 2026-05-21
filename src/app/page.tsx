import { createServerSupabase } from "@/lib/supabase/client";
import { PageShell } from "@/components/PageShell";
import { MatchCard } from "@/components/MatchCard";
import { ProAmaTabs } from "@/components/TabSwitch";
import type { Match, Player, Prediction } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const current: "pro" | "ama" = tab === "ama" ? "ama" : "pro";
  const isAmateur = current === "ama";

  const sb = createServerSupabase();
  // 今日以降 14日先までで is_live=true のもの (アマも is_live true 同条件)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { data: matchesRaw, error } = await sb
    .from("matches")
    .select("*")
    .eq("is_amateur", isAmateur)
    .gte("match_date", fmt(today))
    .lte("match_date", fmt(horizon))
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true, nullsFirst: false });

  const matches = (matchesRaw ?? []) as unknown as Match[];
  const liveMatches = matches.filter((m) => m.is_live);

  // 必要な棋士と最新予想を一括取得
  const playerIds = Array.from(new Set(liveMatches.flatMap((m) => [m.player_a_id, m.player_b_id])));
  const matchIds = liveMatches.map((m) => m.id);

  const [{ data: players }, { data: preds }] = await Promise.all([
    playerIds.length > 0
      ? sb.from("players").select("*").in("id", playerIds)
      : Promise.resolve({ data: [] }),
    matchIds.length > 0
      ? sb
          .from("predictions")
          .select("*")
          .in("match_id", matchIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const playerMap = new Map<string, Player>(
    ((players ?? []) as unknown as Player[]).map((p) => [p.id, p]),
  );
  const predMap = new Map<string, Prediction>();
  for (const p of ((preds ?? []) as unknown as Prediction[])) {
    if (!predMap.has(p.match_id)) predMap.set(p.match_id, p);
  }

  return (
    <PageShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-shu-400">
            this week
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold">今週のLive中継対局</h1>
          <p className="mt-2 text-xs text-sumi-300">
            Live 中継が確認できた対局だけを表示。7要素のデータ根拠で勝敗を予想します。
          </p>
        </div>
        <ProAmaTabs current={current} />
      </div>

      {error ? (
        <div className="rounded-lg border border-shu-500/30 bg-shu-500/10 p-4 text-sm text-shu-300">
          データ取得に失敗しました: {error.message}
        </div>
      ) : liveMatches.length === 0 ? (
        <EmptyState isAmateur={isAmateur} totalCount={matches.length} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {liveMatches.map((m) => {
            const a = playerMap.get(m.player_a_id);
            const b = playerMap.get(m.player_b_id);
            if (!a || !b) return null;
            return (
              <MatchCard
                key={m.id}
                match={m}
                playerA={a}
                playerB={b}
                prediction={predMap.get(m.id) ?? null}
              />
            );
          })}
        </div>
      )}

      <FilterNote totalNonLive={matches.length - liveMatches.length} />
    </PageShell>
  );
}

function EmptyState({ isAmateur, totalCount }: { isAmateur: boolean; totalCount: number }) {
  return (
    <div className="rounded-2xl border border-dashed border-washi-100/10 p-12 text-center">
      <p className="font-serif text-xl mb-3">
        Live 中継対象の{isAmateur ? "アマ" : "プロ"}対局はまだ登録されていません
      </p>
      <p className="text-sm text-sumi-400 mb-1">
        {totalCount === 0
          ? "対局スケジュールを管理画面から登録してください。"
          : `中継未確認の対局が ${totalCount} 件あります。中継URLを登録すると表示されます。`}
      </p>
      <p className="text-xs text-sumi-500 mt-4">
        将棋連盟サイト復旧後、自動取得スイッチを有効化すると毎週自動入力されます。
      </p>
    </div>
  );
}

function FilterNote({ totalNonLive }: { totalNonLive: number }) {
  if (totalNonLive <= 0) return null;
  return (
    <p className="mt-8 text-[11px] text-sumi-500">
      ※ 中継未確認の対局 {totalNonLive} 件はトップから除外しています (DB には登録済)。
    </p>
  );
}
