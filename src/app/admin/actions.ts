"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";
import { regeneratePrediction, finalizeMatchResult } from "@/lib/prediction/repository";

// ---------------------- Players ----------------------
export async function createPlayer(formData: FormData) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    kanji_name: String(formData.get("kanji_name") ?? formData.get("name") ?? "").trim(),
    rank: String(formData.get("rank") ?? "四段").trim(),
    region: (String(formData.get("region") ?? "") || null) as "tokyo" | "kansai" | null,
    rating: Number(formData.get("rating") ?? 1500),
    master: String(formData.get("master") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  if (!payload.name) throw new Error("名前は必須です");
  const { error } = await sb.from("players").insert(payload);
  if (error) throw error;
  revalidatePath("/admin/players");
  revalidatePath("/players");
}

export async function updatePlayer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id 必須");
  const sb = createAdminSupabase();
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "kanji_name", "rank", "master", "notes"]) {
    const v = formData.get(key);
    if (v != null) patch[key] = String(v).trim() || null;
  }
  const region = formData.get("region");
  if (region != null) patch.region = String(region) || null;
  const rating = formData.get("rating");
  if (rating != null && rating !== "") patch.rating = Number(rating);
  const { error } = await sb.from("players").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/players");
  revalidatePath("/players");
}

export async function deletePlayer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const sb = createAdminSupabase();
  const { error } = await sb.from("players").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/players");
  revalidatePath("/players");
}

// ---------------------- Player Stats ----------------------
export async function upsertPlayerStats(formData: FormData) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const player_id = String(formData.get("player_id") ?? "");
  const snapshot_date = String(formData.get("snapshot_date") ?? new Date().toISOString().slice(0, 10));
  if (!player_id) throw new Error("棋士ID必須");
  const numFields = [
    "total_wins",
    "total_losses",
    "recent_1m_wins",
    "recent_1m_losses",
    "recent_3m_wins",
    "recent_3m_losses",
    "recent_1y_wins",
    "recent_1y_losses",
    "season_wins",
    "season_losses",
    "current_streak",
    "sente_wins",
    "sente_losses",
    "gote_wins",
    "gote_losses",
    "sennichite_count",
    "jishogi_count",
  ];
  const payload: Record<string, unknown> = { player_id, snapshot_date };
  for (const k of numFields) {
    payload[k] = Number(formData.get(k) ?? 0);
  }
  const { error } = await sb
    .from("player_stats")
    .upsert(payload, { onConflict: "player_id,snapshot_date" });
  if (error) throw error;
  revalidatePath("/admin/player-stats");
  revalidatePath(`/players/${player_id}`);
}

// ---------------------- Player Openings ----------------------
export async function upsertPlayerOpening(formData: FormData) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const player_id = String(formData.get("player_id") ?? "");
  const opening = String(formData.get("opening") ?? "");
  const side = (String(formData.get("side") ?? "") || null) as "sente" | "gote" | null;
  const wins = Number(formData.get("wins") ?? 0);
  const losses = Number(formData.get("losses") ?? 0);
  if (!player_id || !opening) throw new Error("入力不足");
  const { error } = await sb
    .from("player_openings")
    .upsert(
      { player_id, opening, side, wins, losses },
      { onConflict: "player_id,opening,side" },
    );
  if (error) throw error;
  revalidatePath(`/players/${player_id}`);
  revalidatePath("/admin/player-stats");
}

// ---------------------- Head-to-Head ----------------------
export async function addHeadToHead(formData: FormData) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const payload = {
    player_a_id: String(formData.get("player_a_id") ?? ""),
    player_b_id: String(formData.get("player_b_id") ?? ""),
    match_date: String(formData.get("match_date") ?? ""),
    tournament: String(formData.get("tournament") ?? "").trim() || null,
    opening: String(formData.get("opening") ?? "").trim() || null,
    winner_id: String(formData.get("winner_id") ?? "") || null,
    kifu_url: String(formData.get("kifu_url") ?? "").trim() || null,
  };
  if (!payload.player_a_id || !payload.player_b_id || !payload.match_date)
    throw new Error("対戦者・日付は必須");
  if (payload.player_a_id === payload.player_b_id)
    throw new Error("同じ棋士同士は登録できません");
  const { error } = await sb.from("head_to_head").insert(payload);
  if (error) throw error;
  revalidatePath("/admin/head-to-head");
}

export async function deleteHeadToHead(formData: FormData) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const id = String(formData.get("id") ?? "");
  const { error } = await sb.from("head_to_head").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/head-to-head");
}

// ---------------------- Matches ----------------------
export async function createMatch(formData: FormData) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const a = String(formData.get("player_a_id") ?? "");
  const b = String(formData.get("player_b_id") ?? "");
  if (!a || !b) throw new Error("対局者必須");
  if (a === b) throw new Error("同じ棋士同士は登録できません");
  const payload = {
    match_date: String(formData.get("match_date") ?? ""),
    match_time: String(formData.get("match_time") ?? "").trim() || null,
    tournament: String(formData.get("tournament") ?? "").trim(),
    player_a_id: a,
    player_b_id: b,
    sente_id: String(formData.get("sente_id") ?? "") || null,
    time_control: String(formData.get("time_control") ?? "one_day"),
    is_live: formData.get("is_live") === "on",
    live_url_shogi_or_jp: String(formData.get("live_url_shogi_or_jp") ?? "").trim() || null,
    live_url_abema: String(formData.get("live_url_abema") ?? "").trim() || null,
    live_url_premium: String(formData.get("live_url_premium") ?? "").trim() || null,
    is_amateur: formData.get("is_amateur") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  if (!payload.match_date || !payload.tournament) throw new Error("日付・棋戦名必須");
  const { data, error } = await sb.from("matches").insert(payload).select("*").single();
  if (error) throw error;
  revalidatePath("/admin/matches");
  revalidatePath("/");
  return data;
}

export async function updateMatchLive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const is_live = formData.get("is_live") === "on";
  const sb = createAdminSupabase();
  const { error } = await sb.from("matches").update({ is_live }).eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/matches");
  revalidatePath("/");
}

export async function deleteMatch(formData: FormData) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const id = String(formData.get("id") ?? "");
  const { error } = await sb.from("matches").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/matches");
  revalidatePath("/");
}

// ---------------------- Prediction regenerate ----------------------
export async function regenerate(formData: FormData) {
  await requireAdmin();
  const matchId = String(formData.get("match_id") ?? "");
  if (!matchId) throw new Error("match_id 必須");
  await regeneratePrediction(matchId);
  revalidatePath(`/match/${matchId}`);
  revalidatePath("/");
  revalidatePath("/accuracy");
}

// ---------------------- Result finalize ----------------------
export async function finalizeResult(formData: FormData) {
  await requireAdmin();
  const matchId = String(formData.get("match_id") ?? "");
  const winnerId = String(formData.get("winner_id") ?? "");
  if (!matchId || !winnerId) throw new Error("対局・勝者必須");
  await finalizeMatchResult(matchId, winnerId);
  revalidatePath("/admin/results");
  revalidatePath("/accuracy");
  revalidatePath(`/match/${matchId}`);
}

// ---------------------- Weights ----------------------
export async function saveWeights(formData: FormData) {
  await requireAdmin();
  const weights = {
    rating: Number(formData.get("rating") ?? 0),
    recent_1m: Number(formData.get("recent_1m") ?? 0),
    head_to_head: Number(formData.get("head_to_head") ?? 0),
    opening_match: Number(formData.get("opening_match") ?? 0),
    side: Number(formData.get("side") ?? 0),
    tournament_time: Number(formData.get("tournament_time") ?? 0),
    streak: Number(formData.get("streak") ?? 0),
  };
  const sum = Object.values(weights).reduce((s, v) => s + v, 0);
  if (Math.abs(sum - 1) > 0.001)
    throw new Error(`合計が 1.0 になっていません (現在 ${sum.toFixed(3)})`);
  const note = String(formData.get("note") ?? "").trim() || null;
  const sb = createAdminSupabase();
  const { error } = await sb
    .from("weight_history")
    .insert({ weights_json: weights, changed_by: "admin", note });
  if (error) throw error;
  revalidatePath("/admin/weights");
}

// ---------------------- Amateurs ----------------------
export async function createAmateur(formData: FormData) {
  await requireAdmin();
  const sb = createAdminSupabase();
  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    age: formData.get("age") ? Number(formData.get("age")) : null,
    branch: String(formData.get("branch") ?? "").trim() || null,
    ama_rank: String(formData.get("ama_rank") ?? "").trim() || null,
    is_ex_shoreikai: formData.get("is_ex_shoreikai") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  if (!payload.name) throw new Error("名前必須");
  const { error } = await sb.from("amateurs").insert(payload);
  if (error) throw error;
  revalidatePath("/admin/amateurs");
  revalidatePath("/amateurs");
}

export async function deleteAmateur(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const sb = createAdminSupabase();
  const { error } = await sb.from("amateurs").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/amateurs");
  revalidatePath("/amateurs");
}

export async function navigateTo(path: string) {
  redirect(path);
}
