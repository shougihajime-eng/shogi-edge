import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/client";
import { predict } from "@/lib/prediction/engine";
import { loadInputForMatch } from "@/lib/prediction/repository";
import type { BacktestResult, Prediction, WeightSet } from "@/types/db";

// =============================================================
// バックテスト: 過去の確定済み予想を新しい重みで再計算
// =============================================================

export async function runBacktest(
  proposedWeights: WeightSet,
  baselineWeights: WeightSet,
  periodStart: Date,
  periodEnd: Date,
): Promise<BacktestResult> {
  const sb = createServerSupabase();
  const admin = createAdminSupabase();

  // 期間内の終局済み対局を全部取る
  const { data: matches } = await sb
    .from("matches")
    .select("id, result_winner_id, status")
    .eq("status", "finished")
    .gte("match_date", periodStart.toISOString().slice(0, 10))
    .lte("match_date", periodEnd.toISOString().slice(0, 10));
  const finishedMatches = (matches ?? []) as { id: string; result_winner_id: string }[];

  let baseline_correct = 0;
  let proposed_correct = 0;
  let n = 0;
  for (const m of finishedMatches) {
    if (!m.result_winner_id) continue;
    // baseline は既存の prediction を使うのが本来だが、評価の一貫性のため再計算
    let input;
    try {
      input = await loadInputForMatch(m.id);
    } catch {
      continue;
    }
    const baselinePred = predict({ ...input, weights: baselineWeights });
    const proposedPred = predict({ ...input, weights: proposedWeights });
    if (baselinePred.predicted_winner_id === m.result_winner_id) baseline_correct += 1;
    if (proposedPred.predicted_winner_id === m.result_winner_id) proposed_correct += 1;
    n += 1;
  }

  const current_accuracy = n > 0 ? baseline_correct / n : 0;
  const projected_accuracy = n > 0 ? proposed_correct / n : 0;
  const delta = projected_accuracy - current_accuracy;

  const { data: inserted, error } = await admin
    .from("backtest_results")
    .insert({
      proposed_weights_json: proposedWeights,
      baseline_weights_json: baselineWeights,
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      sample_size: n,
      current_accuracy,
      projected_accuracy,
      delta,
      decision: "pending",
      note: n < 10 ? "サンプルサイズが少ない (信頼性低)" : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return inserted as unknown as BacktestResult;
}

// 予想を新しい重みで一括再計算 (試運転用 — 本番 predictions テーブルは更新しない)
export async function dryRunForWeights(weights: WeightSet, since: Date) {
  const sb = createServerSupabase();
  const { data: predRows } = await sb
    .from("predictions")
    .select("id, match_id, predicted_winner_id, win_prob_a, win_prob_b, created_at")
    .gte("created_at", since.toISOString());
  const baseline = (predRows ?? []) as Prediction[];

  const items: { match_id: string; before: number; after: number; delta: number }[] = [];
  for (const p of baseline) {
    try {
      const input = await loadInputForMatch(p.match_id);
      const next = predict({ ...input, weights });
      items.push({
        match_id: p.match_id,
        before: p.win_prob_a,
        after: next.win_prob_a,
        delta: next.win_prob_a - p.win_prob_a,
      });
    } catch {
      continue;
    }
  }
  return items;
}
