import "server-only";
import { createServerSupabase } from "@/lib/supabase/client";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type {
  HeadToHead,
  Match,
  MatchReflection,
  MonthlyReflection,
  Player,
  Prediction,
  WeeklyReflection,
} from "@/types/db";
import { generateMatchReflection } from "./engine";
import { buildPatternKeys, updateWeaknessPatterns } from "./weakness";

// =============================================================
// 振り返り DB I/O + 自動生成パイプライン
// =============================================================

// 対局結果確定 → 振り返り生成 + 弱点パターン更新を1セットで実行
export async function reflectOnFinishedMatch(matchId: string, actualWinnerId: string) {
  const admin = createAdminSupabase();
  const sb = createServerSupabase();

  const { data: matchRaw, error: mErr } = await sb
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (mErr || !matchRaw) return; // 対局が見つからない

  const match = matchRaw as unknown as Match;
  const { data: predsRaw } = await sb
    .from("predictions")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false });
  const preds = ((predsRaw ?? []) as unknown as Prediction[]) ?? [];
  if (preds.length === 0) return; // 予想がないなら振り返るものなし

  const [{ data: paRaw }, { data: pbRaw }] = await Promise.all([
    sb.from("players").select("*").eq("id", match.player_a_id).single(),
    sb.from("players").select("*").eq("id", match.player_b_id).single(),
  ]);
  if (!paRaw || !pbRaw) return;
  const player_a = paRaw as unknown as Player;
  const player_b = pbRaw as unknown as Player;

  // 最新の予想だけを振り返り対象にする (同じ対局に複数 prediction がある場合、最新だけ)
  const latest = preds[0];
  const reflection = await generateMatchReflection({
    match,
    prediction: latest,
    player_a,
    player_b,
    actual_winner_id: actualWinnerId,
  });

  await admin.from("match_reflections").upsert(
    {
      match_id: matchId,
      prediction_id: latest.id,
      predicted_winner_id: latest.predicted_winner_id,
      actual_winner_id: actualWinnerId,
      is_correct: reflection.is_correct,
      result_summary: reflection.result_summary,
      honest_review: reflection.honest_review,
      lesson_learned: reflection.lesson_learned,
      factor_attribution_json: reflection.factor_attribution_json,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "prediction_id" },
  );

  // 弱点パターン更新 (信頼度ペナルティを次回予想に反映)
  const patternKeys = buildPatternKeys({
    prediction: latest,
    match,
    player_a,
    player_b,
  });
  await updateWeaknessPatterns({
    patternKeys,
    is_correct: reflection.is_correct,
  });
}

// 1 試合の振り返り取得
export async function loadReflectionByMatch(matchId: string): Promise<MatchReflection | null> {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("match_reflections")
    .select("*")
    .eq("match_id", matchId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as MatchReflection) ?? null;
}

// /accuracy 用: 最新の週次・月次・過去全部
export async function loadWeeklyReflections(limit = 12): Promise<WeeklyReflection[]> {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("weekly_reflections")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as WeeklyReflection[]) ?? [];
}

export async function loadMonthlyReflections(limit = 12): Promise<MonthlyReflection[]> {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("monthly_reflections")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as MonthlyReflection[]) ?? [];
}

// 最新週次振り返り (1件)
export async function loadLatestWeeklyReflection(): Promise<WeeklyReflection | null> {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("weekly_reflections")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as WeeklyReflection) ?? null;
}

// h2h を見て、過去対戦の戦型分布 (週次の patterns_found 用)
export async function loadRecentHeadToHead(limit = 50): Promise<HeadToHead[]> {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("head_to_head")
    .select("*")
    .order("match_date", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as HeadToHead[]) ?? [];
}

// 単一 prediction の振り返りを再生成 (管理画面の「再生成」ボタン用)
export async function regenerateMatchReflectionById(predictionId: string) {
  const sb = createServerSupabase();
  const { data: predRow } = await sb
    .from("predictions")
    .select("*")
    .eq("id", predictionId)
    .single();
  if (!predRow) throw new Error("予想が見つかりません");
  const prediction = predRow as unknown as Prediction;

  const { data: resRow } = await sb
    .from("prediction_results")
    .select("*")
    .eq("prediction_id", predictionId)
    .maybeSingle();
  if (!resRow) throw new Error("結果未確定の対局は振り返りを生成できません");
  const actualWinnerId = (resRow as { actual_winner_id: string }).actual_winner_id;

  await reflectOnFinishedMatch(prediction.match_id, actualWinnerId);
}

// 月次提案の承認 → 重み履歴に新エントリを追加
export async function approveMonthlyProposal(monthlyId: string) {
  const admin = createAdminSupabase();
  const sb = createServerSupabase();

  const { data: monthlyRow } = await sb
    .from("monthly_reflections")
    .select("*")
    .eq("id", monthlyId)
    .single();
  if (!monthlyRow) throw new Error("月次振り返りが見つかりません");
  const monthly = monthlyRow as unknown as MonthlyReflection;
  if (monthly.approval_status !== "pending")
    throw new Error("既に承認/却下済みです");

  const { data: latest } = await sb
    .from("weight_history")
    .select("weights_json")
    .order("changed_at", { ascending: false })
    .limit(1)
    .single();
  const current = (latest as { weights_json: import("@/types/db").WeightSet })
    .weights_json;
  const next: import("@/types/db").WeightSet = { ...current };
  for (const p of monthly.weight_adjustment_proposals_json) {
    next[p.key] = p.proposed;
  }
  // 合計を 1.0 に正規化
  const sum = Object.values(next).reduce((s, v) => s + v, 0);
  if (sum > 0) {
    for (const k of Object.keys(next) as (keyof typeof next)[]) {
      next[k] = Math.round((next[k] / sum) * 1000) / 1000;
    }
  }
  await admin.from("weight_history").insert({
    weights_json: next,
    changed_by: "monthly_approval",
    note: `月次振り返り (${monthly.month}) からの自動適用`,
  });
  await admin
    .from("monthly_reflections")
    .update({
      approved_changes_json: next,
      approval_status: "approved",
      approved_at: new Date().toISOString(),
    })
    .eq("id", monthlyId);
}

export async function rejectMonthlyProposal(monthlyId: string) {
  const admin = createAdminSupabase();
  await admin
    .from("monthly_reflections")
    .update({
      approval_status: "rejected",
      approved_at: new Date().toISOString(),
    })
    .eq("id", monthlyId);
}
