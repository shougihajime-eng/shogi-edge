import "server-only";
import { createServerSupabase } from "@/lib/supabase/client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type {
  HeadToHead,
  Match,
  Player,
  PlayerOpening,
  PlayerStats,
  Prediction,
  WeightSet,
} from "@/types/db";
import { DEFAULT_WEIGHTS, predict } from "./engine";
import { generateSummary } from "@/lib/llm/summary";
import {
  buildPatternKeysFromInputs,
  calcConfidencePenalty,
  expectedOpeningsFromHeadToHead,
} from "@/lib/reflection/weakness";

// 予想に必要な全データを 1 マッチについて読む
export async function loadInputForMatch(matchId: string) {
  const sb = createServerSupabase();
  const { data: match, error: mErr } = await sb
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (mErr || !match) throw new Error(`対局が見つかりません: ${matchId}`);

  const m = match as unknown as Match;
  const [{ data: pa }, { data: pb }] = await Promise.all([
    sb.from("players").select("*").eq("id", m.player_a_id).single(),
    sb.from("players").select("*").eq("id", m.player_b_id).single(),
  ]);
  if (!pa || !pb) throw new Error("棋士情報が欠落しています");

  const [{ data: statsA }, { data: statsB }] = await Promise.all([
    sb
      .from("player_stats")
      .select("*")
      .eq("player_id", m.player_a_id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("player_stats")
      .select("*")
      .eq("player_id", m.player_b_id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const [{ data: opensA }, { data: opensB }] = await Promise.all([
    sb.from("player_openings").select("*").eq("player_id", m.player_a_id),
    sb.from("player_openings").select("*").eq("player_id", m.player_b_id),
  ]);

  const { data: h2hRows } = await sb
    .from("head_to_head")
    .select("*")
    .or(
      `and(player_a_id.eq.${m.player_a_id},player_b_id.eq.${m.player_b_id}),and(player_a_id.eq.${m.player_b_id},player_b_id.eq.${m.player_a_id})`,
    )
    .order("match_date", { ascending: false });

  return {
    match: m,
    player_a: pa as unknown as Player,
    player_b: pb as unknown as Player,
    stats_a: (statsA as unknown as PlayerStats) ?? null,
    stats_b: (statsB as unknown as PlayerStats) ?? null,
    openings_a: ((opensA ?? []) as unknown as PlayerOpening[]) ?? [],
    openings_b: ((opensB ?? []) as unknown as PlayerOpening[]) ?? [],
    head_to_heads: ((h2hRows ?? []) as unknown as HeadToHead[]) ?? [],
  };
}

// 最新の重み (weight_history の最新行)
export async function loadLatestWeights(): Promise<WeightSet> {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("weight_history")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_WEIGHTS;
  return (data as unknown as { weights_json: WeightSet }).weights_json;
}

// 予想を生成して predictions に upsert
// 弱点パターンDB に登録のあるパターンに該当する場合は信頼度を下げる
export async function regeneratePrediction(matchId: string): Promise<Prediction> {
  const input = await loadInputForMatch(matchId);
  const weights = await loadLatestWeights();
  const out = predict({ ...input, weights });

  // 弱点パターン → 信頼度ペナルティ (★を下げる)
  const expectedOpenings = expectedOpeningsFromHeadToHead(input.head_to_heads);
  const patternKeys = buildPatternKeysFromInputs({
    match: input.match,
    player_a: input.player_a,
    player_b: input.player_b,
    expected_openings:
      Object.keys(expectedOpenings).length > 0 ? expectedOpenings : null,
  });
  const { penalty } = await calcConfidencePenalty({ patternKeys });
  const adjustedConfidence = Math.max(1, out.confidence - penalty);

  const summary = await generateSummary({
    player_a_name: input.player_a.name,
    player_b_name: input.player_b.name,
    win_prob_a: out.win_prob_a,
    win_prob_b: out.win_prob_b,
    reasoning_seed: out.summary_seed,
    confidence: adjustedConfidence,
  });

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("predictions")
    .insert({
      match_id: matchId,
      predicted_winner_id: out.predicted_winner_id,
      win_prob_a: out.win_prob_a,
      win_prob_b: out.win_prob_b,
      confidence: adjustedConfidence,
      summary,
      reasoning_json: out.reasoning_json,
      expected_openings: out.expected_openings,
      model_weights_json: out.model_weights_json,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Prediction;
}

// 最新の予想を取得 (なければ null)
export async function loadLatestPrediction(matchId: string): Promise<Prediction | null> {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("predictions")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as Prediction) ?? null;
}

// 対局結果を確定 → 予想結果を記録 + 振り返り自動生成 + 弱点パターン更新
export async function finalizeMatchResult(matchId: string, winnerId: string) {
  const admin = createAdminSupabase();
  const { error: e1 } = await admin
    .from("matches")
    .update({ status: "finished", result_winner_id: winnerId })
    .eq("id", matchId);
  if (e1) throw e1;

  // 該当試合の全予想に的中/外れを記録
  const { data: preds } = await admin
    .from("predictions")
    .select("*")
    .eq("match_id", matchId);
  if (!preds) return;
  for (const p of preds as unknown as Prediction[]) {
    await admin.from("prediction_results").upsert(
      {
        prediction_id: p.id,
        actual_winner_id: winnerId,
        is_correct: p.predicted_winner_id === winnerId,
      },
      { onConflict: "prediction_id" },
    );
  }

  // 振り返り自動生成 + 弱点パターン更新 (循環参照回避のため動的 import)
  try {
    const { reflectOnFinishedMatch } = await import("@/lib/reflection/repository");
    await reflectOnFinishedMatch(matchId, winnerId);
  } catch (err) {
    console.error("[reflection] generation failed for", matchId, err);
    // 振り返り失敗は致命傷ではない — メインフローは続行
  }
}
