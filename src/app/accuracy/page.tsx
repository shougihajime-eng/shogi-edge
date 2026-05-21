import { createServerSupabase } from "@/lib/supabase/client";
import { PageShell } from "@/components/PageShell";
import { ConfidenceStars } from "@/components/ConfidenceStars";
import {
  WeeklyReflectionCard,
  WeeklyReflectionSummaryRow,
  MonthlyReflectionCard,
} from "@/components/ReflectionCard";
import { WeeklyScriptCopier } from "@/components/WeeklyScriptCopier";
import {
  loadLatestWeeklyReflection,
  loadWeeklyReflections,
  loadMonthlyReflections,
} from "@/lib/reflection/repository";
import { buildWeeklyReflectionScript } from "@/lib/reflection/youtube";
import type {
  Match,
  MatchReflection,
  Player,
  Prediction,
  PredictionResult,
  WeightHistory,
} from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AccuracyPage() {
  const sb = createServerSupabase();
  const [
    { data: predsRaw },
    { data: resultsRaw },
    { data: weightHistRaw },
    latestWeekly,
    pastWeeklies,
    monthlies,
  ] = await Promise.all([
    sb.from("predictions").select("*"),
    sb.from("prediction_results").select("*"),
    sb
      .from("weight_history")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(20),
    loadLatestWeeklyReflection(),
    loadWeeklyReflections(12),
    loadMonthlyReflections(6),
  ]);
  const preds = ((predsRaw ?? []) as unknown as Prediction[]) ?? [];
  const results = ((resultsRaw ?? []) as unknown as PredictionResult[]) ?? [];
  const weights = ((weightHistRaw ?? []) as unknown as WeightHistory[]) ?? [];
  const resultById = new Map(results.map((r) => [r.prediction_id, r]));
  const finalized = preds.filter((p) => resultById.has(p.id));
  const totalAccuracy =
    finalized.length === 0
      ? null
      : finalized.filter((p) => resultById.get(p.id)!.is_correct).length / finalized.length;

  // 信頼度別
  const byConfidence: Record<number, { hit: number; total: number }> = {};
  for (const p of finalized) {
    const k = p.confidence;
    byConfidence[k] ??= { hit: 0, total: 0 };
    byConfidence[k].total += 1;
    if (resultById.get(p.id)!.is_correct) byConfidence[k].hit += 1;
  }

  // 振り返り台本のためにハイライト3つを取得
  let weeklyScript: string | null = null;
  if (latestWeekly) {
    const { data: reflRaw } = await sb
      .from("match_reflections")
      .select("*")
      .gte("generated_at", `${latestWeekly.period_start}T00:00:00Z`)
      .lte("generated_at", `${latestWeekly.period_end}T23:59:59Z`)
      .order("generated_at", { ascending: false })
      .limit(20);
    const reflections = ((reflRaw ?? []) as unknown as MatchReflection[]) ?? [];

    // 的中×1、外し×2、無ければあるだけ
    const hits = reflections.filter((r) => r.is_correct).slice(0, 1);
    const misses = reflections.filter((r) => !r.is_correct).slice(0, 2);
    const picked = [...hits, ...misses].slice(0, 3);

    if (picked.length > 0) {
      const matchIds = picked.map((r) => r.match_id);
      const { data: matchesRaw } = await sb
        .from("matches")
        .select("*")
        .in("id", matchIds);
      const matches = ((matchesRaw ?? []) as unknown as Match[]) ?? [];
      const playerIds = Array.from(
        new Set(matches.flatMap((m) => [m.player_a_id, m.player_b_id])),
      );
      const { data: playersRaw } = await sb
        .from("players")
        .select("*")
        .in("id", playerIds);
      const players = ((playersRaw ?? []) as unknown as Player[]) ?? [];

      const highlights = picked
        .map((r) => {
          const match = matches.find((m) => m.id === r.match_id);
          if (!match) return null;
          const matchPlayers = players.filter(
            (p) => p.id === match.player_a_id || p.id === match.player_b_id,
          );
          return { reflection: r, match, players: matchPlayers };
        })
        .filter((h): h is NonNullable<typeof h> => h !== null);

      weeklyScript = buildWeeklyReflectionScript({ weekly: latestWeekly, highlights });
    } else {
      weeklyScript = buildWeeklyReflectionScript({ weekly: latestWeekly, highlights: [] });
    }
  }

  return (
    <PageShell>
      <header className="mb-8">
        <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-shu-400">tracking</p>
        <h1 className="font-serif text-3xl font-bold">予想精度トラッキング</h1>
        <p className="mt-2 text-xs text-sumi-300">
          終局後に結果が登録された予想について、的中率と AI の振り返り日記を時系列で集計します。
        </p>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard
          label="全体的中率"
          value={
            totalAccuracy == null
              ? "—"
              : `${(totalAccuracy * 100).toFixed(1)}%`
          }
          subtitle={`${finalized.filter((p) => resultById.get(p.id)!.is_correct).length} / ${finalized.length} 試合`}
        />
        <StatCard
          label="累計予想数"
          value={String(preds.length)}
          subtitle={`未終了 ${preds.length - finalized.length}`}
        />
        <StatCard label="KPI 目標" value="60% / 75%" subtitle="全体 / 信頼度★5" />
      </section>

      <section className="mb-8 rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
        <h3 className="mb-4 font-serif text-lg">信頼度別 的中率</h3>
        <ul className="divide-y divide-washi-100/5">
          {[5, 4, 3, 2, 1].map((c) => {
            const row = byConfidence[c];
            const rate = row && row.total > 0 ? row.hit / row.total : null;
            return (
              <li key={c} className="flex items-center justify-between py-2.5">
                <ConfidenceStars value={c} size="md" />
                <span className="font-num text-sm tabular-nums text-washi-200">
                  {rate == null ? "—" : `${(rate * 100).toFixed(1)}% (${row.hit}/${row.total})`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 週次振り返り (最新) */}
      {latestWeekly && (
        <section className="mb-8 space-y-4">
          <WeeklyReflectionCard weekly={latestWeekly} />
          {weeklyScript && <WeeklyScriptCopier initialScript={weeklyScript} />}
        </section>
      )}

      {/* 過去の週次振り返り */}
      {pastWeeklies.length > 1 && (
        <section className="mb-8 rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
          <h3 className="mb-4 font-serif text-lg">過去の週次振り返り</h3>
          <ul>
            {pastWeeklies.slice(1).map((w) => (
              <WeeklyReflectionSummaryRow key={w.id} weekly={w} />
            ))}
          </ul>
        </section>
      )}

      {/* 月次振り返り */}
      {monthlies.length > 0 && (
        <section className="mb-8 space-y-3">
          <h3 className="px-1 font-serif text-lg">月次振り返り</h3>
          {monthlies.map((m) => (
            <MonthlyReflectionCard key={m.id} monthly={m} />
          ))}
        </section>
      )}

      {/* 重み変更履歴タイムライン */}
      <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
        <h3 className="mb-4 font-serif text-lg">重み変更履歴</h3>
        {weights.length === 0 ? (
          <p className="text-sm text-sumi-400">まだ重み履歴がありません</p>
        ) : (
          <ol className="space-y-3">
            {weights.map((w) => (
              <li
                key={w.id}
                className="rounded-xl border-l-2 border-kincha-500/40 bg-sumi-800/40 px-4 py-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-num text-[11px] tabular-nums text-sumi-300">
                    {new Date(w.changed_at).toLocaleString("ja-JP")}
                  </p>
                  <p className="text-[10px] text-kincha-500">
                    {w.changed_by ?? "system"}
                  </p>
                </div>
                {w.note && (
                  <p className="mb-1 text-xs text-washi-200">{w.note}</p>
                )}
                <p className="font-num text-[11px] text-sumi-400">
                  rating {(w.weights_json.rating * 100).toFixed(0)}% / recent_1m {(w.weights_json.recent_1m * 100).toFixed(0)}% / h2h {(w.weights_json.head_to_head * 100).toFixed(0)}% / opening {(w.weights_json.opening_match * 100).toFixed(0)}% / side {(w.weights_json.side * 100).toFixed(0)}% / tournament {(w.weights_json.tournament_time * 100).toFixed(0)}% / streak {(w.weights_json.streak * 100).toFixed(0)}%
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <p className="text-[10px] uppercase tracking-widest text-sumi-400">{label}</p>
      <p className="mt-2 font-num text-3xl font-bold tabular-nums text-washi-100">{value}</p>
      {subtitle ? <p className="mt-1 text-[11px] text-sumi-400">{subtitle}</p> : null}
    </div>
  );
}
