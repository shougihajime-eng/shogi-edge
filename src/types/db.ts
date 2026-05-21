// Supabase の shogi_edge スキーマの型定義(手書き / 仕様書 §4 準拠)
// 自動生成したい場合は `supabase gen types typescript --schema shogi_edge` で上書き

export type Region = "tokyo" | "kansai";
export type MatchStatus = "scheduled" | "ongoing" | "finished" | "cancelled";
export type TimeControl =
  | "long" // 長時間 (タイトル戦・順位戦等)
  | "one_day" // 一日制 (4〜6時間)
  | "fast" // 早指し (1時間以下)
  | "ultra_fast"; // 超早指し (フィッシャー等)

export type SenteGote = "sente" | "gote";

export type OpeningCategory =
  | "ai_kakari" // 相掛かり
  | "kakugawari" // 角換わり
  | "yokofudori" // 横歩取り
  | "yagura" // 矢倉
  | "gangi" // 雁木
  | "shikenbisha" // 四間飛車
  | "sankenbisha" // 三間飛車
  | "nakabisha" // 中飛車
  | "mukaibisha" // 向かい飛車
  | "gokigen" // ゴキゲン中飛車
  | "fujii_system" // 藤井システム
  | "other";

export interface Player {
  id: string;
  name: string;
  kanji_name: string;
  rank: string;
  birth_date: string | null;
  master: string | null;
  region: Region | null;
  debut_date: string | null;
  rating: number;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Amateur {
  id: string;
  name: string;
  age: number | null;
  branch: string | null;
  ama_rank: string | null;
  is_ex_shoreikai: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerStats {
  id: string;
  player_id: string;
  snapshot_date: string;
  total_wins: number;
  total_losses: number;
  recent_1m_wins: number;
  recent_1m_losses: number;
  recent_3m_wins: number;
  recent_3m_losses: number;
  recent_1y_wins: number;
  recent_1y_losses: number;
  season_wins: number;
  season_losses: number;
  current_streak: number; // 正=連勝 / 負=連敗
  sente_wins: number;
  sente_losses: number;
  gote_wins: number;
  gote_losses: number;
  sennichite_count: number;
  jishogi_count: number;
  created_at: string;
}

export interface PlayerOpening {
  id: string;
  player_id: string;
  opening: OpeningCategory;
  side: SenteGote | null;
  wins: number;
  losses: number;
  updated_at: string;
}

export interface HeadToHead {
  id: string;
  player_a_id: string;
  player_b_id: string;
  match_date: string;
  tournament: string | null;
  opening: OpeningCategory | null;
  winner_id: string | null;
  kifu_url: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  match_date: string; // ISO date
  match_time: string | null; // HH:MM
  tournament: string;
  player_a_id: string;
  player_b_id: string;
  sente_id: string | null;
  time_control: TimeControl;
  is_live: boolean;
  live_url_shogi_or_jp: string | null;
  live_url_abema: string | null;
  live_url_premium: string | null;
  status: MatchStatus;
  result_winner_id: string | null;
  is_amateur: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReasoningEntry {
  factor: string;
  detail: string;
  impact: string; // 例 "+12%"
  impact_num: number; // 数値
}

export interface ExpectedOpeningDistribution {
  [openingName: string]: number; // 0〜1
}

export interface Prediction {
  id: string;
  match_id: string;
  predicted_winner_id: string;
  win_prob_a: number; // 0〜1
  win_prob_b: number; // 0〜1
  confidence: number; // 1〜5
  summary: string;
  reasoning_json: ReasoningEntry[];
  expected_openings: ExpectedOpeningDistribution | null;
  model_weights_json: WeightSet;
  created_at: string;
}

export interface PredictionResult {
  id: string;
  prediction_id: string;
  actual_winner_id: string;
  is_correct: boolean;
  finalized_at: string;
}

export interface WeightSet {
  rating: number;
  recent_1m: number;
  head_to_head: number;
  opening_match: number;
  side: number;
  tournament_time: number;
  streak: number;
}

export interface WeightHistory {
  id: string;
  weights_json: WeightSet;
  changed_by: string | null;
  note: string | null;
  changed_at: string;
}

export interface TournamentAmateur {
  id: string;
  name: string;
  match_date: string;
  location: string | null;
  prize_money: string | null;
  has_live: boolean;
  notes: string | null;
  created_at: string;
}

export interface AmateurResult {
  id: string;
  tournament_id: string;
  amateur_id: string;
  rank: number | null;
  opponents_json: { name: string; result: "win" | "lose" }[] | null;
  notes: string | null;
}

// =============================================================
// 0002: 自己学習・振り返り機能 (仕様書 §9)
// =============================================================

// 7要素のうちどれが正しい/誤った信号を出していたか
export interface FactorAttribution {
  factor: string;            // 「レーティング差」「戦型相性」など
  had_correct_signal: boolean;
  weight: number;            // その時の重み (0〜1)
  impact_num: number;        // -1〜+1 (a視点)
}

export interface MatchReflection {
  id: string;
  match_id: string;
  prediction_id: string;
  predicted_winner_id: string;
  actual_winner_id: string;
  is_correct: boolean;
  result_summary: string;
  honest_review: string;
  lesson_learned: string;
  factor_attribution_json: FactorAttribution[];
  generated_at: string;
}

export interface ConfidenceBucket {
  total: number;
  correct: number;
  accuracy: number; // 0〜1
}

export interface WeeklyReflection {
  id: string;
  week: string;                // 'YYYY-Www'
  period_start: string;
  period_end: string;
  total: number;
  correct: number;
  accuracy: number;
  confidence_breakdown_json: Record<string, ConfidenceBucket>;
  weekly_summary: string;
  patterns_found_json: string[];
  improvement_suggestions_json: string[];
  next_week_focus: string;
  generated_at: string;
}

export interface WeightAdjustmentProposal {
  key: keyof WeightSet;
  current: number;
  proposed: number;
  rationale: string;
}

export interface MonthlyReflection {
  id: string;
  month: string;               // 'YYYY-MM'
  period_start: string;
  period_end: string;
  total: number;
  correct: number;
  accuracy: number;
  trends_json: {
    by_tournament: Record<string, ConfidenceBucket>;
    by_player: Record<string, ConfidenceBucket>;
    by_opening: Record<string, ConfidenceBucket>;
    accuracy_timeline: { date: string; accuracy: number; total: number }[];
  };
  weight_adjustment_proposals_json: WeightAdjustmentProposal[];
  approved_changes_json: WeightSet | null;
  approval_status: "pending" | "approved" | "rejected";
  approved_at: string | null;
  generated_at: string;
}

export interface WeaknessPattern {
  id: string;
  pattern_key: string;
  description: string | null;
  total_attempts: number;
  miss_count: number;
  confidence_penalty: number;  // 0〜2
  last_updated: string;
  notes: string | null;
}

export interface BacktestResult {
  id: string;
  proposed_weights_json: WeightSet;
  baseline_weights_json: WeightSet;
  period_start: string;
  period_end: string;
  sample_size: number;
  current_accuracy: number;
  projected_accuracy: number;
  delta: number;
  decision: "pending" | "approved" | "rejected";
  note: string | null;
  tested_at: string;
}

// supabase-js generic 用の最小スキーマ
export interface Database {
  shogi_edge: {
    Tables: {
      players: { Row: Player; Insert: Partial<Player>; Update: Partial<Player> };
      amateurs: { Row: Amateur; Insert: Partial<Amateur>; Update: Partial<Amateur> };
      player_stats: {
        Row: PlayerStats;
        Insert: Partial<PlayerStats>;
        Update: Partial<PlayerStats>;
      };
      player_openings: {
        Row: PlayerOpening;
        Insert: Partial<PlayerOpening>;
        Update: Partial<PlayerOpening>;
      };
      head_to_head: {
        Row: HeadToHead;
        Insert: Partial<HeadToHead>;
        Update: Partial<HeadToHead>;
      };
      matches: { Row: Match; Insert: Partial<Match>; Update: Partial<Match> };
      predictions: {
        Row: Prediction;
        Insert: Partial<Prediction>;
        Update: Partial<Prediction>;
      };
      prediction_results: {
        Row: PredictionResult;
        Insert: Partial<PredictionResult>;
        Update: Partial<PredictionResult>;
      };
      weight_history: {
        Row: WeightHistory;
        Insert: Partial<WeightHistory>;
        Update: Partial<WeightHistory>;
      };
      tournaments_amateur: {
        Row: TournamentAmateur;
        Insert: Partial<TournamentAmateur>;
        Update: Partial<TournamentAmateur>;
      };
      amateur_results: {
        Row: AmateurResult;
        Insert: Partial<AmateurResult>;
        Update: Partial<AmateurResult>;
      };
      match_reflections: {
        Row: MatchReflection;
        Insert: Partial<MatchReflection>;
        Update: Partial<MatchReflection>;
      };
      weekly_reflections: {
        Row: WeeklyReflection;
        Insert: Partial<WeeklyReflection>;
        Update: Partial<WeeklyReflection>;
      };
      monthly_reflections: {
        Row: MonthlyReflection;
        Insert: Partial<MonthlyReflection>;
        Update: Partial<MonthlyReflection>;
      };
      weakness_patterns: {
        Row: WeaknessPattern;
        Insert: Partial<WeaknessPattern>;
        Update: Partial<WeaknessPattern>;
      };
      backtest_results: {
        Row: BacktestResult;
        Insert: Partial<BacktestResult>;
        Update: Partial<BacktestResult>;
      };
    };
    Views: object;
    Functions: object;
    Enums: object;
  };
}
