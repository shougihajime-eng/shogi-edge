// =============================================================
// Shogi Edge — 勝敗予想エンジン
// 仕様書 §1.4 多変量加重スコアリング (7要素)
// =============================================================
//
// 設計原則:
//   * 入力は「DB から取ってきた事実だけ」(player, stats, opening dist, h2h, match)
//   * 出力は { win_prob_a, win_prob_b, confidence ★1〜5, reasoning[], expected_openings }
//   * **適当な数字は絶対に作らない**。データが無い要素は impact = 0 とし、reasoning に「データ不足」を明記する
//   * 重みは weight_history テーブルから外部注入 (管理画面でチューニング可能)
//
// 重みの意味 (合計 1.00):
//   rating          0.30 — 棋士レーティング差
//   recent_1m       0.20 — 直近1ヶ月勝率差
//   head_to_head    0.15 — 直接対戦成績
//   opening_match   0.15 — 想定戦型と相手の戦型別勝率
//   side            0.08 — 先手後手別勝率
//   tournament_time 0.07 — 棋戦・持ち時間別勝率
//   streak          0.05 — 現在の連勝連敗

import type {
  HeadToHead,
  Match,
  Player,
  PlayerOpening,
  PlayerStats,
  Prediction,
  ReasoningEntry,
  SenteGote,
  WeightSet,
  ExpectedOpeningDistribution,
} from "@/types/db";

export const DEFAULT_WEIGHTS: WeightSet = {
  rating: 0.3,
  recent_1m: 0.2,
  head_to_head: 0.15,
  opening_match: 0.15,
  side: 0.08,
  tournament_time: 0.07,
  streak: 0.05,
};

export interface PredictionInput {
  match: Match;
  player_a: Player;
  player_b: Player;
  stats_a: PlayerStats | null;
  stats_b: PlayerStats | null;
  openings_a: PlayerOpening[];
  openings_b: PlayerOpening[];
  head_to_heads: HeadToHead[]; // 全対戦履歴(時系列)
  weights?: WeightSet;
}

export type EngineOutput = Pick<
  Prediction,
  | "predicted_winner_id"
  | "win_prob_a"
  | "win_prob_b"
  | "confidence"
  | "reasoning_json"
  | "expected_openings"
  | "model_weights_json"
> & {
  summary_seed: string; // Claude に渡す素の根拠文(後段で口調変換)
};

// -----------------------------------------------------------------
// 1. 各要素の貢献度(-1 〜 +1 の範囲、a視点)を返す純粋関数
// -----------------------------------------------------------------

// (1) レーティング差: イロレーティング差を確率に変換した上で a への偏りを返す
function ratingFactor(a: Player, b: Player) {
  const diff = a.rating - b.rating;
  // イロレーティング 400差 で勝率10倍。a の勝率を計算
  const pa = 1 / (1 + Math.pow(10, -diff / 400));
  return {
    impact_num: (pa - 0.5) * 2, // -1 〜 +1
    detail: `${a.name} ${a.rating} vs ${b.name} ${b.rating}(差${diff > 0 ? "+" : ""}${diff.toFixed(0)})`,
    has_data: true,
  };
}

// (2) 直近1ヶ月勝率差
function recent1mFactor(a: PlayerStats | null, b: PlayerStats | null, an: string, bn: string) {
  const winrate = (s: PlayerStats | null) => {
    if (!s) return null;
    const g = s.recent_1m_wins + s.recent_1m_losses;
    if (g < 3) return null; // 3局未満は判断できない
    return s.recent_1m_wins / g;
  };
  const wa = winrate(a);
  const wb = winrate(b);
  if (wa == null || wb == null) {
    return {
      impact_num: 0,
      detail: `データ不足 (${an}=${a ? `${a.recent_1m_wins}勝${a.recent_1m_losses}敗` : "未登録"} / ${bn}=${b ? `${b.recent_1m_wins}勝${b.recent_1m_losses}敗` : "未登録"})`,
      has_data: false,
    };
  }
  const diff = wa - wb;
  return {
    impact_num: Math.max(-1, Math.min(1, diff * 2)), // 勝率差 0.5 で +1
    detail: `${an} ${a!.recent_1m_wins}勝${a!.recent_1m_losses}敗(.${(wa * 1000).toFixed(0).padStart(3, "0")}) vs ${bn} ${b!.recent_1m_wins}勝${b!.recent_1m_losses}敗(.${(wb * 1000).toFixed(0).padStart(3, "0")})`,
    has_data: true,
  };
}

// (3) 直接対戦成績
function headToHeadFactor(h2h: HeadToHead[], aId: string, bId: string, an: string) {
  const filtered = h2h.filter(
    (h) =>
      (h.player_a_id === aId && h.player_b_id === bId) ||
      (h.player_a_id === bId && h.player_b_id === aId),
  );
  const decided = filtered.filter((h) => h.winner_id != null);
  if (decided.length === 0) {
    return { impact_num: 0, detail: "直接対戦の記録なし", has_data: false, total: 0 };
  }
  const aWins = decided.filter((h) => h.winner_id === aId).length;
  const winrate = aWins / decided.length;
  return {
    impact_num: Math.max(-1, Math.min(1, (winrate - 0.5) * 2)),
    detail: `通算${decided.length}局 ${an}${aWins}勝${decided.length - aWins}敗(.${(winrate * 1000).toFixed(0).padStart(3, "0")})`,
    has_data: true,
    total: decided.length,
  };
}

// (4) 戦型相性: 想定戦型分布 × 「相手はその戦型に弱いか強いか」を加重平均
//    想定戦型は「両者の直近 head_to_head から多い順に推定」
function expectedOpenings(h2h: HeadToHead[]): ExpectedOpeningDistribution {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const h of h2h.slice(0, 20)) {
    if (!h.opening) continue;
    counts[h.opening] = (counts[h.opening] ?? 0) + 1;
    total += 1;
  }
  if (total === 0) return {};
  const dist: ExpectedOpeningDistribution = {};
  for (const [k, v] of Object.entries(counts)) {
    dist[k] = v / total;
  }
  return dist;
}

function openingMatchFactor(
  dist: ExpectedOpeningDistribution,
  openings_a: PlayerOpening[],
  openings_b: PlayerOpening[],
) {
  const opens = Object.entries(dist);
  if (opens.length === 0) {
    return { impact_num: 0, detail: "想定戦型データ不足", has_data: false };
  }
  const winrate = (list: PlayerOpening[], opening: string) => {
    const rows = list.filter((o) => o.opening === opening);
    if (rows.length === 0) return null;
    const w = rows.reduce((s, r) => s + r.wins, 0);
    const l = rows.reduce((s, r) => s + r.losses, 0);
    if (w + l < 3) return null;
    return w / (w + l);
  };
  let aScore = 0;
  let bScore = 0;
  let covered = 0;
  const details: string[] = [];
  for (const [open, prob] of opens) {
    const wa = winrate(openings_a, open);
    const wb = winrate(openings_b, open);
    if (wa != null && wb != null) {
      aScore += wa * prob;
      bScore += wb * prob;
      covered += prob;
      details.push(`${open}${(prob * 100).toFixed(0)}%: ${(wa * 100).toFixed(0)}/${(wb * 100).toFixed(0)}`);
    }
  }
  if (covered === 0) {
    return { impact_num: 0, detail: "両者の戦型別データ不足", has_data: false };
  }
  const aNorm = aScore / covered;
  const bNorm = bScore / covered;
  return {
    impact_num: Math.max(-1, Math.min(1, (aNorm - bNorm) * 2)),
    detail: `想定戦型 ${details.join(" / ")}`,
    has_data: true,
  };
}

// (5) 手番(先手/後手)別勝率
function sideFactor(
  a: PlayerStats | null,
  b: PlayerStats | null,
  match: Match,
  an: string,
) {
  if (!a || !b) return { impact_num: 0, detail: "成績データ不足", has_data: false };
  const aSente = match.sente_id === match.player_a_id;
  const bSente = match.sente_id === match.player_b_id;
  if (!match.sente_id) {
    return { impact_num: 0, detail: "先手未確定", has_data: false };
  }
  const rate = (wins: number, losses: number) => {
    if (wins + losses < 5) return null;
    return wins / (wins + losses);
  };
  const aRate = aSente ? rate(a.sente_wins, a.sente_losses) : rate(a.gote_wins, a.gote_losses);
  const bRate = bSente ? rate(b.sente_wins, b.sente_losses) : rate(b.gote_wins, b.gote_losses);
  if (aRate == null || bRate == null) {
    return { impact_num: 0, detail: "手番別データ不足", has_data: false };
  }
  return {
    impact_num: Math.max(-1, Math.min(1, (aRate - bRate) * 2)),
    detail: `${an}${aSente ? "先手" : "後手"}勝率.${(aRate * 1000).toFixed(0).padStart(3, "0")}`,
    has_data: true,
  };
}

// (6) 棋戦・持ち時間別 — 簡略: 直近1y勝率を時間制御で読みの精度として代用
function tournamentTimeFactor(
  a: PlayerStats | null,
  b: PlayerStats | null,
  match: Match,
  an: string,
) {
  const rate = (s: PlayerStats | null) => {
    if (!s) return null;
    const g = s.recent_1y_wins + s.recent_1y_losses;
    if (g < 10) return null;
    return s.recent_1y_wins / g;
  };
  const wa = rate(a);
  const wb = rate(b);
  if (wa == null || wb == null) {
    return { impact_num: 0, detail: "1年間成績データ不足", has_data: false };
  }
  return {
    impact_num: Math.max(-1, Math.min(1, (wa - wb) * 2)),
    detail: `${match.tournament}・持ち時間${labelTimeControl(match.time_control)}。${an}直近1年.${(wa * 1000).toFixed(0).padStart(3, "0")}`,
    has_data: true,
  };
}

function labelTimeControl(tc: Match["time_control"]): string {
  switch (tc) {
    case "long":
      return "長時間";
    case "one_day":
      return "一日制";
    case "fast":
      return "早指し";
    case "ultra_fast":
      return "超早指し";
  }
}

// (7) 連勝/連敗
function streakFactor(a: PlayerStats | null, b: PlayerStats | null, an: string, bn: string) {
  if (!a || !b) return { impact_num: 0, detail: "連勝記録データ不足", has_data: false };
  const tag = (s: number) => (s === 0 ? "±0" : s > 0 ? `${s}連勝` : `${-s}連敗`);
  const score = (s: number) => {
    // ±5 で ±1.0 にサチる。3連勝以下はほぼ無視
    const sign = Math.sign(s);
    return sign * Math.min(1, Math.abs(s) / 5);
  };
  const diff = score(a.current_streak) - score(b.current_streak);
  return {
    impact_num: Math.max(-1, Math.min(1, diff)),
    detail: `${an}${tag(a.current_streak)} / ${bn}${tag(b.current_streak)}`,
    has_data: true,
  };
}

// -----------------------------------------------------------------
// 2. 信頼度算出
// -----------------------------------------------------------------
function calcConfidence(args: {
  h2hCount: number;
  recent_data_count: number; // 0〜2
  opening_has_data: boolean;
  match_is_amateur: boolean;
}): number {
  const { h2hCount, recent_data_count, opening_has_data, match_is_amateur } = args;
  if (match_is_amateur && recent_data_count <= 0) return 1;
  if (h2hCount >= 5 && recent_data_count >= 2 && opening_has_data) return 5;
  if (h2hCount >= 3 && recent_data_count >= 2) return 4;
  if (h2hCount >= 1 && recent_data_count >= 1) return 3;
  if (h2hCount === 0 && recent_data_count >= 1) return 2;
  return 1;
}

// -----------------------------------------------------------------
// 3. メイン
// -----------------------------------------------------------------
export function predict(input: PredictionInput): EngineOutput {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const { match, player_a, player_b, stats_a, stats_b, openings_a, openings_b, head_to_heads } =
    input;

  const dist = expectedOpenings(head_to_heads);

  const f_rating = ratingFactor(player_a, player_b);
  const f_recent = recent1mFactor(stats_a, stats_b, player_a.name, player_b.name);
  const f_h2h = headToHeadFactor(head_to_heads, player_a.id, player_b.id, player_a.name);
  const f_opening = openingMatchFactor(dist, openings_a, openings_b);
  const f_side = sideFactor(stats_a, stats_b, match, player_a.name);
  const f_time = tournamentTimeFactor(stats_a, stats_b, match, player_a.name);
  const f_streak = streakFactor(stats_a, stats_b, player_a.name, player_b.name);

  // 加重和 (a視点)、有データ要素のみ集計
  const components = [
    { key: "rating" as const, label: "レーティング差", w: weights.rating, ...f_rating },
    { key: "recent_1m" as const, label: "直近1ヶ月成績", w: weights.recent_1m, ...f_recent },
    { key: "head_to_head" as const, label: "直接対戦", w: weights.head_to_head, ...f_h2h },
    { key: "opening_match" as const, label: "戦型相性", w: weights.opening_match, ...f_opening },
    { key: "side" as const, label: "手番", w: weights.side, ...f_side },
    { key: "tournament_time" as const, label: "棋戦・持ち時間", w: weights.tournament_time, ...f_time },
    { key: "streak" as const, label: "調子", w: weights.streak, ...f_streak },
  ];

  // 有データ要素の重みを再正規化 (データなし要素を勝手に補完しない)
  const dataWeightSum = components.filter((c) => c.has_data).reduce((s, c) => s + c.w, 0) || 1;
  let aBias = 0;
  for (const c of components) {
    if (!c.has_data) continue;
    aBias += (c.w / dataWeightSum) * c.impact_num;
  }
  // aBias は -1 〜 +1。これを確率に変換 (シグモイド的)
  const winA = 1 / (1 + Math.exp(-2.0 * aBias));
  const winB = 1 - winA;

  const reasoning_json: ReasoningEntry[] = components.map((c) => ({
    factor: c.label,
    detail: c.detail,
    impact: c.has_data
      ? `${c.impact_num >= 0 ? "+" : ""}${((c.impact_num * (c.w / dataWeightSum)) * 100).toFixed(1)}%`
      : "判断保留",
    impact_num: c.has_data ? c.impact_num * (c.w / dataWeightSum) : 0,
  }));

  const recent_data_count = (stats_a ? 1 : 0) + (stats_b ? 1 : 0);
  const confidence = calcConfidence({
    h2hCount: "total" in f_h2h && typeof f_h2h.total === "number" ? f_h2h.total : 0,
    recent_data_count,
    opening_has_data: f_opening.has_data,
    match_is_amateur: match.is_amateur,
  });

  const predicted_winner_id = winA >= winB ? player_a.id : player_b.id;
  const winnerName = winA >= winB ? player_a.name : player_b.name;

  // Claude に渡す素材: 全要素 + 確率 + 信頼度
  const summary_seed = [
    `予想勝者: ${winnerName} (${(Math.max(winA, winB) * 100).toFixed(0)}% / 信頼度★${confidence})`,
    `${player_a.name} ${(winA * 100).toFixed(0)}% — ${player_b.name} ${(winB * 100).toFixed(0)}%`,
    "",
    "根拠:",
    ...components
      .filter((c) => c.has_data)
      .sort((a, b) => Math.abs(b.impact_num * b.w) - Math.abs(a.impact_num * a.w))
      .map((c) => `- ${c.label}: ${c.detail} (寄与 ${c.impact_num >= 0 ? "+" : ""}${((c.impact_num * (c.w / dataWeightSum)) * 100).toFixed(1)}%)`),
    ...components
      .filter((c) => !c.has_data)
      .map((c) => `- ${c.label}: ${c.detail}`),
  ].join("\n");

  return {
    predicted_winner_id,
    win_prob_a: Number(winA.toFixed(4)),
    win_prob_b: Number(winB.toFixed(4)),
    confidence,
    reasoning_json,
    expected_openings: Object.keys(dist).length > 0 ? dist : null,
    model_weights_json: weights,
    summary_seed,
  };
}

// helper: side label
export function sideLabel(s: SenteGote | null): string {
  if (s === "sente") return "先手";
  if (s === "gote") return "後手";
  return "—";
}
