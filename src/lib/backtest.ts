import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type {
  BacktestResult,
  HeadToHead,
  Match,
  Player,
  PlayerOpening,
  PlayerStats,
  Prediction,
  PredictionResult,
  WeightSet,
} from "@/types/db";
import { predict, DEFAULT_WEIGHTS } from "@/lib/prediction/engine";

// =============================================================
// バックテスト (仕様書 §9.5)
// 過去 N ヶ月の対局に新しい重み案を適用した場合の予想を再計算し、
// 現行重みと比較した的中率を出す。
// 推測ではなく、実データ + 新重みでの計算のみ。
// =============================================================

export interface BacktestInput {
  proposedWeights: WeightSet;
  baselineWeights: WeightSet;
  daysBack?: number; // デフォルト 90日
  note?: string;
}

export interface BacktestOutcome {
  sampleSize: number;
  currentAccuracy: number;
  projectedAccuracy: number;
  delta: number;
  periodStart: string;
  periodEnd: string;
  perMatch: {
    match_id: string;
    actual_winner_id: string;
    baseline_predicted_winner_id: string;
    baseline_is_correct: boolean;
    proposed_predicted_winner_id: string;
    proposed_is_correct: boolean;
  }[];
}

export async function runBacktest(input: BacktestInput): Promise<BacktestOutcome> {
  const daysBack = input.daysBack ?? 90;
  const admin = createAdminSupabase();

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);

  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  // 期間内に終局済み + result_winner_id がある対局
  const { data: matchesRaw } = await admin
    .from("matches")
    .select("*")
    .gte("match_date", startISO)
    .lte("match_date", endISO)
    .eq("status", "finished")
    .not("result_winner_id", "is", null);
  const matches = ((matchesRaw ?? []) as unknown as Match[]) ?? [];

  if (matches.length === 0) {
    return {
      sampleSize: 0,
      currentAccuracy: 0,
      projectedAccuracy: 0,
      delta: 0,
      periodStart: startISO,
      periodEnd: endISO,
      perMatch: [],
    };
  }

  // 必要なデータを一括ロード
  const playerIds = Array.from(
    new Set(matches.flatMap((m) => [m.player_a_id, m.player_b_id])),
  );

  const [{ data: playersRaw }, { data: statsRaw }, { data: opensRaw }, { data: h2hRaw }] = await Promise.all([
    admin.from("players").select("*").in("id", playerIds),
    admin
      .from("player_stats")
      .select("*")
      .in("player_id", playerIds)
      .order("snapshot_date", { ascending: false }),
    admin.from("player_openings").select("*").in("player_id", playerIds),
    admin
      .from("head_to_head")
      .select("*")
      .or(
        playerIds.length === 0
          ? "id.eq.00000000-0000-0000-0000-000000000000"
          : playerIds.map((id) => `player_a_id.eq.${id},player_b_id.eq.${id}`).join(","),
      ),
  ]);

  const players = ((playersRaw ?? []) as unknown as Player[]) ?? [];
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const stats = ((statsRaw ?? []) as unknown as PlayerStats[]) ?? [];
  const opens = ((opensRaw ?? []) as unknown as PlayerOpening[]) ?? [];
  const h2hAll = ((h2hRaw ?? []) as unknown as HeadToHead[]) ?? [];

  // 棋士ごとの最新スナップショット (バックテスト時点では「対局時より新しい」可能性はあるが現状の DB 設計上ベストエフォート)
  const latestStatsByPlayer = new Map<string, PlayerStats>();
  for (const s of stats) {
    const cur = latestStatsByPlayer.get(s.player_id);
    if (!cur || new Date(s.snapshot_date) > new Date(cur.snapshot_date)) {
      latestStatsByPlayer.set(s.player_id, s);
    }
  }
  const opensByPlayer = new Map<string, PlayerOpening[]>();
  for (const o of opens) {
    const arr = opensByPlayer.get(o.player_id) ?? [];
    arr.push(o);
    opensByPlayer.set(o.player_id, arr);
  }

  let baselineCorrect = 0;
  let proposedCorrect = 0;
  const perMatch: BacktestOutcome["perMatch"] = [];

  for (const m of matches) {
    const pa = playerMap.get(m.player_a_id);
    const pb = playerMap.get(m.player_b_id);
    if (!pa || !pb || !m.result_winner_id) continue;
    const h2hFiltered = h2hAll.filter(
      (h) =>
        (h.player_a_id === pa.id && h.player_b_id === pb.id) ||
        (h.player_a_id === pb.id && h.player_b_id === pa.id),
    );
    const inputData = {
      match: m,
      player_a: pa,
      player_b: pb,
      stats_a: latestStatsByPlayer.get(pa.id) ?? null,
      stats_b: latestStatsByPlayer.get(pb.id) ?? null,
      openings_a: opensByPlayer.get(pa.id) ?? [],
      openings_b: opensByPlayer.get(pb.id) ?? [],
      head_to_heads: h2hFiltered,
    };

    const baseline = predict({ ...inputData, weights: input.baselineWeights });
    const proposed = predict({ ...inputData, weights: input.proposedWeights });

    const baseOK = baseline.predicted_winner_id === m.result_winner_id;
    const propOK = proposed.predicted_winner_id === m.result_winner_id;

    if (baseOK) baselineCorrect += 1;
    if (propOK) proposedCorrect += 1;

    perMatch.push({
      match_id: m.id,
      actual_winner_id: m.result_winner_id,
      baseline_predicted_winner_id: baseline.predicted_winner_id,
      baseline_is_correct: baseOK,
      proposed_predicted_winner_id: proposed.predicted_winner_id,
      proposed_is_correct: propOK,
    });
  }

  const N = perMatch.length || 1;
  const currentAccuracy = baselineCorrect / N;
  const projectedAccuracy = proposedCorrect / N;
  return {
    sampleSize: perMatch.length,
    currentAccuracy,
    projectedAccuracy,
    delta: projectedAccuracy - currentAccuracy,
    periodStart: startISO,
    periodEnd: endISO,
    perMatch,
  };
}

// バックテスト結果を保存
export async function saveBacktest(args: {
  outcome: BacktestOutcome;
  proposedWeights: WeightSet;
  baselineWeights: WeightSet;
  note?: string;
}): Promise<BacktestResult | null> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("backtest_results")
    .insert({
      proposed_weights_json: args.proposedWeights,
      baseline_weights_json: args.baselineWeights,
      period_start: args.outcome.periodStart,
      period_end: args.outcome.periodEnd,
      sample_size: args.outcome.sampleSize,
      current_accuracy: Number(args.outcome.currentAccuracy.toFixed(4)),
      projected_accuracy: Number(args.outcome.projectedAccuracy.toFixed(4)),
      delta: Number(args.outcome.delta.toFixed(4)),
      decision: "pending",
      note: args.note ?? null,
    })
    .select("*")
    .single();
  if (error) return null;
  return data as unknown as BacktestResult;
}

// 直近のバックテストを表示用に取得
export async function listRecentBacktests(limit = 10): Promise<BacktestResult[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("backtest_results")
    .select("*")
    .order("tested_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as BacktestResult[]) ?? [];
}

export { DEFAULT_WEIGHTS };
export type { Prediction, PredictionResult };
