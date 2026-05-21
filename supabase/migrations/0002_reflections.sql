-- =============================================================
-- Shogi Edge — 0002: 自己学習・振り返り機能 (仕様書 §9)
-- match_reflections / weekly_reflections / monthly_reflections
-- weakness_patterns / backtest_results
-- =============================================================

-- -----------------------------------------------------------------
-- match_reflections — 対局単位の振り返り
-- -----------------------------------------------------------------
create table if not exists shogi_edge.match_reflections (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references shogi_edge.matches(id) on delete cascade,
  prediction_id uuid not null references shogi_edge.predictions(id) on delete cascade,
  predicted_winner_id uuid not null references shogi_edge.players(id),
  actual_winner_id uuid not null references shogi_edge.players(id),
  is_correct boolean not null,
  result_summary text not null,          -- 「永瀬の角換わり腰掛銀から序盤主導権、86手で永瀬勝ち」
  honest_review text not null,           -- AI が外したならその理由を正直に書いた本文
  lesson_learned text not null,          -- 次に活かす教訓
  factor_attribution_json jsonb not null, -- [{factor, had_correct_signal, weight}]
  generated_at timestamptz not null default now(),
  unique (prediction_id)
);

create index if not exists match_reflections_match_idx on shogi_edge.match_reflections (match_id);
create index if not exists match_reflections_generated_idx on shogi_edge.match_reflections (generated_at desc);

-- -----------------------------------------------------------------
-- weekly_reflections — 週次振り返り
-- -----------------------------------------------------------------
create table if not exists shogi_edge.weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  week text not null unique,             -- ISO 8601 'YYYY-Www' 例: 2026-W21
  period_start date not null,
  period_end date not null,
  total int not null default 0,
  correct int not null default 0,
  accuracy numeric(5,4) not null default 0,
  confidence_breakdown_json jsonb not null,    -- { "5_star": {total, correct, accuracy}, ... }
  weekly_summary text not null,
  patterns_found_json jsonb not null,    -- string[]
  improvement_suggestions_json jsonb not null, -- string[]
  next_week_focus text not null,
  generated_at timestamptz not null default now()
);

create index if not exists weekly_reflections_period_idx on shogi_edge.weekly_reflections (period_start desc);

-- -----------------------------------------------------------------
-- monthly_reflections — 月次振り返り (週次の集計 + 重み調整提案)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.monthly_reflections (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,            -- 'YYYY-MM' 例: 2026-05
  period_start date not null,
  period_end date not null,
  total int not null default 0,
  correct int not null default 0,
  accuracy numeric(5,4) not null default 0,
  trends_json jsonb not null,            -- 棋戦別 / 棋士別 / 戦型別 of {total, correct, accuracy}
  weight_adjustment_proposals_json jsonb not null, -- [{key, current, proposed, rationale}]
  approved_changes_json jsonb,           -- 承認時に書き込み
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approved_at timestamptz,
  generated_at timestamptz not null default now()
);

create index if not exists monthly_reflections_period_idx on shogi_edge.monthly_reflections (period_start desc);

-- -----------------------------------------------------------------
-- weakness_patterns — 弱点パターン DB
-- -----------------------------------------------------------------
create table if not exists shogi_edge.weakness_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_key text not null unique,      -- 例 "振り飛車_若手_早指し"
  description text,                      -- 人間向け説明
  total_attempts int not null default 0,
  miss_count int not null default 0,
  confidence_penalty int not null default 0, -- 0〜2 (★を下げる量)
  last_updated timestamptz not null default now(),
  notes text
);

create index if not exists weakness_patterns_penalty_idx on shogi_edge.weakness_patterns (confidence_penalty desc);

-- -----------------------------------------------------------------
-- backtest_results — 重み変更のバックテスト履歴
-- -----------------------------------------------------------------
create table if not exists shogi_edge.backtest_results (
  id uuid primary key default gen_random_uuid(),
  proposed_weights_json jsonb not null,
  baseline_weights_json jsonb not null,
  period_start date not null,
  period_end date not null,
  sample_size int not null default 0,
  current_accuracy numeric(5,4) not null,
  projected_accuracy numeric(5,4) not null,
  delta numeric(6,4) not null,
  decision text not null default 'pending' check (decision in ('pending','approved','rejected')),
  note text,
  tested_at timestamptz not null default now()
);

create index if not exists backtest_results_tested_idx on shogi_edge.backtest_results (tested_at desc);

-- =============================================================
-- RLS + anon select ポリシー (5 テーブル分)
-- =============================================================
alter table shogi_edge.match_reflections enable row level security;
alter table shogi_edge.weekly_reflections enable row level security;
alter table shogi_edge.monthly_reflections enable row level security;
alter table shogi_edge.weakness_patterns enable row level security;
alter table shogi_edge.backtest_results enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'match_reflections',
      'weekly_reflections',
      'monthly_reflections',
      'weakness_patterns',
      'backtest_results'
    ])
  loop
    execute format(
      'drop policy if exists "%1$s_anon_select" on shogi_edge.%1$I;', t
    );
    execute format(
      'create policy "%1$s_anon_select" on shogi_edge.%1$I for select to anon using (true);', t
    );
  end loop;
end $$;
