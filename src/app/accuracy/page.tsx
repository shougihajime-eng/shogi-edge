import { createServerSupabase } from "@/lib/supabase/client";
import { PageShell } from "@/components/PageShell";
import { ConfidenceStars } from "@/components/ConfidenceStars";
import type { Prediction, PredictionResult } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AccuracyPage() {
  const sb = createServerSupabase();
  const { data: predsRaw } = await sb.from("predictions").select("*");
  const { data: resultsRaw } = await sb.from("prediction_results").select("*");
  const preds = ((predsRaw ?? []) as unknown as Prediction[]) ?? [];
  const results = ((resultsRaw ?? []) as unknown as PredictionResult[]) ?? [];
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

  return (
    <PageShell>
      <header className="mb-8">
        <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-shu-400">tracking</p>
        <h1 className="font-serif text-3xl font-bold">予想精度トラッキング</h1>
        <p className="mt-2 text-xs text-sumi-300">
          終局後に結果が登録された予想に対して、的中率を集計します。
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
        <StatCard
          label="KPI 目標"
          value="60% / 75%"
          subtitle="全体 / 信頼度★5"
        />
      </section>

      <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
        <h3 className="mb-4 font-serif text-lg">信頼度別 的中率</h3>
        <ul className="divide-y divide-washi-100/5">
          {[5, 4, 3, 2, 1].map((c) => {
            const row = byConfidence[c];
            const rate =
              row && row.total > 0 ? row.hit / row.total : null;
            return (
              <li key={c} className="flex items-center justify-between py-2.5">
                <ConfidenceStars value={c} size="md" />
                <span className="font-num text-sm tabular-nums text-washi-200">
                  {rate == null
                    ? "—"
                    : `${(rate * 100).toFixed(1)}% (${row.hit}/${row.total})`}
                </span>
              </li>
            );
          })}
        </ul>
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
