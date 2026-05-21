import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type {
  ConfidenceBucket,
  Match,
  MatchReflection,
  Player,
  Prediction,
  PredictionResult,
  WeeklyReflection,
  MonthlyReflection,
  WeightAdjustmentProposal,
  WeightSet,
} from "@/types/db";

// =============================================================
// 週次・月次の集計と AI 振り返り生成 (仕様書 §9.3 / §9.4)
// =============================================================

// -----------------------------------------------------------------
// 日付計算ヘルパ
// -----------------------------------------------------------------

// ISO 週番号 (YYYY-Www)
export function isoWeekString(d: Date): string {
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const jan4 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const dayDiff = (target.getTime() - jan4.getTime()) / 86400000;
  const weekNo = 1 + Math.round((dayDiff - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// 月文字列 'YYYY-MM'
export function monthString(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 月曜開始の週の期間 (UTC基準)
export function getWeekBoundary(d: Date): { start: string; end: string } {
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(d.getUTCDate() - day);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function getMonthBoundary(d: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

// -----------------------------------------------------------------
// 集計データロード
// -----------------------------------------------------------------

interface PeriodData {
  reflections: (MatchReflection & { match: Match; prediction: Prediction; players: Player[] })[];
  total: number;
  correct: number;
  accuracy: number;
  byConfidence: Record<string, ConfidenceBucket>;
  byTournament: Record<string, ConfidenceBucket>;
  byPlayer: Record<string, ConfidenceBucket>;
  byOpening: Record<string, ConfidenceBucket>;
}

async function loadPeriodData(periodStart: string, periodEnd: string): Promise<PeriodData> {
  const admin = createAdminSupabase();

  // 期間内に終局した matches とそれに紐づく予想を全部取る
  const { data: matchesRaw } = await admin
    .from("matches")
    .select("*")
    .gte("match_date", periodStart)
    .lte("match_date", periodEnd)
    .eq("status", "finished");
  const matches = ((matchesRaw ?? []) as unknown as Match[]) ?? [];
  const matchIds = matches.map((m) => m.id);

  if (matchIds.length === 0) {
    return {
      reflections: [],
      total: 0,
      correct: 0,
      accuracy: 0,
      byConfidence: {},
      byTournament: {},
      byPlayer: {},
      byOpening: {},
    };
  }

  const { data: predsRaw } = await admin
    .from("predictions")
    .select("*")
    .in("match_id", matchIds);
  const preds = ((predsRaw ?? []) as unknown as Prediction[]) ?? [];

  const predIds = preds.map((p) => p.id);
  const { data: resultsRaw } = await admin
    .from("prediction_results")
    .select("*")
    .in("prediction_id", predIds);
  const results = ((resultsRaw ?? []) as unknown as PredictionResult[]) ?? [];
  const resultMap = new Map(results.map((r) => [r.prediction_id, r]));

  const { data: reflRaw } = await admin
    .from("match_reflections")
    .select("*")
    .in("match_id", matchIds);
  const reflections = ((reflRaw ?? []) as unknown as MatchReflection[]) ?? [];

  // 棋士全員ロード
  const playerIds = Array.from(
    new Set(matches.flatMap((m) => [m.player_a_id, m.player_b_id])),
  );
  const { data: playersRaw } = await admin.from("players").select("*").in("id", playerIds);
  const players = ((playersRaw ?? []) as unknown as Player[]) ?? [];
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // 集計
  let total = 0;
  let correct = 0;
  const byConfidence: Record<string, ConfidenceBucket> = {};
  const byTournament: Record<string, ConfidenceBucket> = {};
  const byPlayer: Record<string, ConfidenceBucket> = {};
  const byOpening: Record<string, ConfidenceBucket> = {};

  const bump = (m: Record<string, ConfidenceBucket>, key: string, ok: boolean) => {
    m[key] ??= { total: 0, correct: 0, accuracy: 0 };
    m[key].total += 1;
    if (ok) m[key].correct += 1;
    m[key].accuracy = m[key].correct / m[key].total;
  };

  // 各試合: 「結果が紐付いている prediction の中で最新のもの」を評価対象にする
  // (finalize 後に再シードで新規 prediction が生まれた場合、それは結果なしなので除外)
  const matchMap = new Map(matches.map((m) => [m.id, m]));
  const latestByMatch = new Map<string, Prediction>();
  for (const p of preds) {
    if (!resultMap.has(p.id)) continue; // 結果未紐付けの予想はスキップ
    const cur = latestByMatch.get(p.match_id);
    if (!cur || new Date(p.created_at) > new Date(cur.created_at)) {
      latestByMatch.set(p.match_id, p);
    }
  }

  for (const m of matches) {
    const p = latestByMatch.get(m.id);
    if (!p) continue;
    const r = resultMap.get(p.id);
    if (!r) continue; // 結果未確定はスキップ
    total += 1;
    if (r.is_correct) correct += 1;
    bump(byConfidence, `${p.confidence}_star`, r.is_correct);
    bump(byTournament, m.tournament, r.is_correct);
    const pa = playerMap.get(m.player_a_id);
    const pb = playerMap.get(m.player_b_id);
    if (pa) bump(byPlayer, pa.name, r.is_correct);
    if (pb) bump(byPlayer, pb.name, r.is_correct);
    const topOpening = topOpeningFromPrediction(p);
    if (topOpening) bump(byOpening, topOpening, r.is_correct);
  }

  const accuracy = total === 0 ? 0 : correct / total;

  // 反映: refl + match + players をまとめた配列
  const detailed = reflections.map((rf) => ({
    ...rf,
    match: matchMap.get(rf.match_id)!,
    prediction: preds.find((p) => p.id === rf.prediction_id)!,
    players: players.filter(
      (pl) =>
        pl.id === matchMap.get(rf.match_id)?.player_a_id ||
        pl.id === matchMap.get(rf.match_id)?.player_b_id,
    ),
  }));

  return {
    reflections: detailed,
    total,
    correct,
    accuracy,
    byConfidence,
    byTournament,
    byPlayer,
    byOpening,
  };
}

function topOpeningFromPrediction(p: Prediction): string | null {
  if (!p.expected_openings) return null;
  const entries = Object.entries(p.expected_openings);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] >= 0.3 ? entries[0][0] : null;
}

// -----------------------------------------------------------------
// 週次振り返り生成
// -----------------------------------------------------------------
export async function generateWeeklyReflection(referenceDate: Date = new Date()): Promise<WeeklyReflection | null> {
  // 「前週」を対象にする (月曜09:00 に走らせる前提)
  const lastWeek = new Date(referenceDate);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const { start, end } = getWeekBoundary(lastWeek);
  const week = isoWeekString(lastWeek);

  const period = await loadPeriodData(start, end);
  if (period.total === 0) {
    // 該当週に終局対局が無いなら空のリフレクション (1件だけ作っておく)
    const admin = createAdminSupabase();
    const empty = {
      week,
      period_start: start,
      period_end: end,
      total: 0,
      correct: 0,
      accuracy: 0,
      confidence_breakdown_json: {},
      weekly_summary: `${start} 〜 ${end} に終局済み対局はありませんでした。`,
      patterns_found_json: [],
      improvement_suggestions_json: [],
      next_week_focus: "来週の見どころは終局データが入り次第。",
    };
    const { data } = await admin
      .from("weekly_reflections")
      .upsert(empty, { onConflict: "week" })
      .select("*")
      .single();
    return (data as unknown as WeeklyReflection) ?? null;
  }

  const ai = await buildWeeklyNarrative({ week, periodData: period });

  const admin = createAdminSupabase();
  const payload = {
    week,
    period_start: start,
    period_end: end,
    total: period.total,
    correct: period.correct,
    accuracy: Number(period.accuracy.toFixed(4)),
    confidence_breakdown_json: period.byConfidence,
    weekly_summary: ai.weekly_summary,
    patterns_found_json: ai.patterns_found,
    improvement_suggestions_json: ai.improvement_suggestions,
    next_week_focus: ai.next_week_focus,
  };
  const { data } = await admin
    .from("weekly_reflections")
    .upsert(payload, { onConflict: "week" })
    .select("*")
    .single();
  return (data as unknown as WeeklyReflection) ?? null;
}

// -----------------------------------------------------------------
// 月次振り返り生成 (週次集計 + 重み調整提案)
// -----------------------------------------------------------------
export async function generateMonthlyReflection(referenceDate: Date = new Date()): Promise<MonthlyReflection | null> {
  // 「前月」を対象にする (毎月1日09:00 に走らせる前提)
  const lastMonth = new Date(referenceDate);
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const { start, end } = getMonthBoundary(lastMonth);
  const month = monthString(lastMonth);

  const period = await loadPeriodData(start, end);
  const proposals = computeWeightAdjustmentProposals(period);

  // 日別の of_accuracy timeline
  const timeline = buildDailyTimeline(period);

  const admin = createAdminSupabase();

  if (period.total === 0) {
    const empty = {
      month,
      period_start: start,
      period_end: end,
      total: 0,
      correct: 0,
      accuracy: 0,
      trends_json: {
        by_tournament: {},
        by_player: {},
        by_opening: {},
        accuracy_timeline: [],
      },
      weight_adjustment_proposals_json: [],
      approved_changes_json: null,
      approval_status: "pending" as const,
      approved_at: null,
    };
    const { data } = await admin
      .from("monthly_reflections")
      .upsert(empty, { onConflict: "month" })
      .select("*")
      .single();
    return (data as unknown as MonthlyReflection) ?? null;
  }

  const payload = {
    month,
    period_start: start,
    period_end: end,
    total: period.total,
    correct: period.correct,
    accuracy: Number(period.accuracy.toFixed(4)),
    trends_json: {
      by_tournament: period.byTournament,
      by_player: period.byPlayer,
      by_opening: period.byOpening,
      accuracy_timeline: timeline,
    },
    weight_adjustment_proposals_json: proposals,
    approved_changes_json: null,
    approval_status: "pending" as const,
    approved_at: null,
  };
  const { data } = await admin
    .from("monthly_reflections")
    .upsert(payload, { onConflict: "month" })
    .select("*")
    .single();
  return (data as unknown as MonthlyReflection) ?? null;
}

// -----------------------------------------------------------------
// 重み調整提案 (簡易ヒューリスティック)
// -----------------------------------------------------------------
function computeWeightAdjustmentProposals(period: PeriodData): WeightAdjustmentProposal[] {
  // 各 reflection の factor_attribution を集計し、要素別の「正しい信号率」を出す
  if (period.reflections.length < 5) return []; // 5局以上ないと判断しない

  const factorStats: Record<string, { correct: number; total: number; avgWeight: number }> = {};
  for (const r of period.reflections) {
    for (const f of r.factor_attribution_json) {
      // weight=0 (データなし) は除外
      if (f.weight === 0) continue;
      factorStats[f.factor] ??= { correct: 0, total: 0, avgWeight: 0 };
      factorStats[f.factor].total += 1;
      factorStats[f.factor].avgWeight += f.weight;
      if (f.had_correct_signal) factorStats[f.factor].correct += 1;
    }
  }

  const proposals: WeightAdjustmentProposal[] = [];
  const labelMap: Record<string, keyof WeightSet> = {
    レーティング差: "rating",
    直近1ヶ月成績: "recent_1m",
    直接対戦: "head_to_head",
    戦型相性: "opening_match",
    手番: "side",
    "棋戦・持ち時間": "tournament_time",
    調子: "streak",
  };

  for (const [label, st] of Object.entries(factorStats)) {
    if (st.total < 3) continue;
    const key = labelMap[label];
    if (!key) continue;
    const current = st.avgWeight / st.total;
    const accuracy = st.correct / st.total;
    // 正解率 65% 超 → 重みを +0.02、35% 未満 → -0.02
    if (accuracy >= 0.65 && current < 0.5) {
      proposals.push({
        key,
        current: Number(current.toFixed(3)),
        proposed: Number(Math.min(0.5, current + 0.02).toFixed(3)),
        rationale: `${label} は ${st.total} 局中 ${st.correct} 回正しい方向を指した (${(accuracy * 100).toFixed(0)}%)。重みを微増。`,
      });
    } else if (accuracy <= 0.35 && current > 0.03) {
      proposals.push({
        key,
        current: Number(current.toFixed(3)),
        proposed: Number(Math.max(0.03, current - 0.02).toFixed(3)),
        rationale: `${label} は ${st.total} 局中 ${st.correct} 回しか正しい方向を指せていない (${(accuracy * 100).toFixed(0)}%)。重みを微減。`,
      });
    }
  }
  return proposals;
}

function buildDailyTimeline(period: PeriodData): { date: string; accuracy: number; total: number }[] {
  const byDate: Record<string, { correct: number; total: number }> = {};
  for (const r of period.reflections) {
    const d = r.match.match_date;
    byDate[d] ??= { correct: 0, total: 0 };
    byDate[d].total += 1;
    if (r.is_correct) byDate[d].correct += 1;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      accuracy: v.total === 0 ? 0 : v.correct / v.total,
      total: v.total,
    }));
}

// -----------------------------------------------------------------
// AI による週次サマリー生成 (Claude or フォールバック)
// -----------------------------------------------------------------

interface WeeklyNarrative {
  weekly_summary: string;
  patterns_found: string[];
  improvement_suggestions: string[];
  next_week_focus: string;
}

const WEEKLY_SYS = `あなたは将棋勝敗予想 AI 「Shogi Edge」の週次振り返りライターです。
口調は YouTuber 「はじめ先生」のフランクな口調 (敬語なし・テンプレ調禁止・言い訳しない)。

出力は必ず JSON:
{
  "weekly_summary": "1〜2文。今週の的中率を結論先出しで",
  "patterns_found": ["気づきA", "気づきB"],
  "improvement_suggestions": ["改善案A", "改善案B"],
  "next_week_focus": "来週の見どころ・注意点 (1〜2文)"
}

ルール:
- 推測ではなくデータから読み取れる事実のみ書く
- 「データを見ると」「分析すると」など AI 臭い導入禁止
- 数値は具体的に`;

async function buildWeeklyNarrative(args: {
  week: string;
  periodData: PeriodData;
}): Promise<WeeklyNarrative> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = buildWeeklyFallback(args);
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const userPrompt = buildWeeklyPrompt(args);
    const resp = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 768,
      system: [
        { type: "text", text: WEEKLY_SYS, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();
    const parsed = tryParseJSON(text);
    if (
      parsed &&
      parsed.weekly_summary &&
      Array.isArray(parsed.patterns_found) &&
      Array.isArray(parsed.improvement_suggestions) &&
      parsed.next_week_focus
    ) {
      return {
        weekly_summary: String(parsed.weekly_summary),
        patterns_found: parsed.patterns_found.map((s: unknown) => String(s)),
        improvement_suggestions: parsed.improvement_suggestions.map((s: unknown) => String(s)),
        next_week_focus: String(parsed.next_week_focus),
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function buildWeeklyPrompt(args: { week: string; periodData: PeriodData }): string {
  const p = args.periodData;
  return [
    `週: ${args.week}`,
    `総予想: ${p.total} 件 / 的中: ${p.correct} / 的中率: ${(p.accuracy * 100).toFixed(1)}%`,
    "",
    "信頼度別:",
    ...Object.entries(p.byConfidence).map(
      ([k, v]) => `  ${k}: ${v.correct}/${v.total} (${(v.accuracy * 100).toFixed(0)}%)`,
    ),
    "",
    "棋戦別 (上位5):",
    ...Object.entries(p.byTournament)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 5)
      .map(([k, v]) => `  ${k}: ${v.correct}/${v.total}`),
    "",
    "戦型別:",
    ...Object.entries(p.byOpening)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([k, v]) => `  ${k}: ${v.correct}/${v.total}`),
    "",
    "→ 今週の振り返りを JSON で書いて (はじめ先生口調)。",
  ].join("\n");
}

function buildWeeklyFallback(args: { week: string; periodData: PeriodData }): WeeklyNarrative {
  const p = args.periodData;
  const accuracyPct = (p.accuracy * 100).toFixed(1);
  const star5 = p.byConfidence["5_star"];
  const star1 = p.byConfidence["1_star"];

  const patterns: string[] = [];
  if (star5 && star5.total > 0 && star5.accuracy >= 0.8) {
    patterns.push(`信頼度★5は ${star5.correct}/${star5.total} と高精度。信頼度の出し方は機能している`);
  }
  if (star1 && star1.total >= 2 && star1.accuracy <= 0.3) {
    patterns.push(`信頼度★1は ${star1.correct}/${star1.total} と弱い。データ不足時のサインとして機能`);
  }
  // 棋戦で弱いところ
  const weakTournament = Object.entries(p.byTournament)
    .filter(([, v]) => v.total >= 2 && v.accuracy <= 0.4)
    .sort(([, a], [, b]) => a.accuracy - b.accuracy)[0];
  if (weakTournament) {
    patterns.push(`${weakTournament[0]} は ${weakTournament[1].correct}/${weakTournament[1].total} と外しが多い`);
  }

  const suggestions: string[] = [];
  if (weakTournament) {
    suggestions.push(`${weakTournament[0]} 系の重みプロファイルを別で持つ案`);
  }
  if (p.total < 10) {
    suggestions.push("サンプル数が少ない。終局結果の登録を増やす");
  }

  return {
    weekly_summary: `今週 ${p.total} 件のうち的中 ${p.correct} (${accuracyPct}%)。`,
    patterns_found: patterns,
    improvement_suggestions: suggestions,
    next_week_focus: `来週は引き続き終局結果を埋め、信頼度別の的中率推移をウォッチする。`,
  };
}

function tryParseJSON(text: string): Record<string, unknown> | null {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
