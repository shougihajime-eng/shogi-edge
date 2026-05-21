-- =============================================================
-- Shogi Edge — initial schema
-- 共有 Supabase の専用スキーマ shogi_edge にすべてを集約する
-- =============================================================

create schema if not exists shogi_edge;

-- 権限付与 (Supabase の anon / authenticated / service_role 用)
grant usage on schema shogi_edge to anon, authenticated, service_role;
grant all on all tables in schema shogi_edge to anon, authenticated, service_role;
grant all on all sequences in schema shogi_edge to anon, authenticated, service_role;
grant all on all functions in schema shogi_edge to anon, authenticated, service_role;
alter default privileges in schema shogi_edge grant all on tables to anon, authenticated, service_role;
alter default privileges in schema shogi_edge grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema shogi_edge grant all on functions to anon, authenticated, service_role;

-- extensions (uuid 生成用)
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------
-- players (プロ棋士)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- 例: 藤井聡太 (公式表記)
  kanji_name text not null,          -- ふりがな違い対策 (同じ漢字でも別人がいる場合)
  rank text not null default '四段', -- 段位 (対局時のスナップショットは別テーブル化を将来検討)
  birth_date date,
  master text,                       -- 師匠
  region text check (region in ('tokyo','kansai')),
  debut_date date,                   -- プロ入り
  rating numeric(7,2) not null default 1500, -- 独自イロレーティング
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, kanji_name)
);

create index if not exists players_name_idx on shogi_edge.players (name);
create index if not exists players_rating_idx on shogi_edge.players (rating desc);

-- -----------------------------------------------------------------
-- amateurs (アマチュア選手)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.amateurs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int,
  branch text,                       -- 所属支部
  ama_rank text,                     -- アマ段位
  is_ex_shoreikai boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

-- -----------------------------------------------------------------
-- player_stats (時系列スナップショット)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.player_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references shogi_edge.players(id) on delete cascade,
  snapshot_date date not null,
  total_wins int not null default 0,
  total_losses int not null default 0,
  recent_1m_wins int not null default 0,
  recent_1m_losses int not null default 0,
  recent_3m_wins int not null default 0,
  recent_3m_losses int not null default 0,
  recent_1y_wins int not null default 0,
  recent_1y_losses int not null default 0,
  season_wins int not null default 0,
  season_losses int not null default 0,
  current_streak int not null default 0,  -- 正=連勝、負=連敗
  sente_wins int not null default 0,
  sente_losses int not null default 0,
  gote_wins int not null default 0,
  gote_losses int not null default 0,
  sennichite_count int not null default 0,
  jishogi_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (player_id, snapshot_date)
);

create index if not exists player_stats_player_idx on shogi_edge.player_stats (player_id, snapshot_date desc);

-- -----------------------------------------------------------------
-- player_openings (戦型別成績)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.player_openings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references shogi_edge.players(id) on delete cascade,
  opening text not null,             -- 戦型カテゴリ (db.ts の OpeningCategory に対応)
  side text check (side in ('sente','gote')),  -- 先手/後手別。NULL なら両方合算
  wins int not null default 0,
  losses int not null default 0,
  updated_at timestamptz not null default now(),
  unique (player_id, opening, side)
);

-- -----------------------------------------------------------------
-- head_to_head (直接対戦記録)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.head_to_head (
  id uuid primary key default gen_random_uuid(),
  player_a_id uuid not null references shogi_edge.players(id) on delete cascade,
  player_b_id uuid not null references shogi_edge.players(id) on delete cascade,
  match_date date not null,
  tournament text,
  opening text,
  winner_id uuid references shogi_edge.players(id),
  kifu_url text,
  created_at timestamptz not null default now(),
  check (player_a_id <> player_b_id)
);

create index if not exists h2h_pair_idx on shogi_edge.head_to_head (player_a_id, player_b_id, match_date desc);
create index if not exists h2h_reverse_idx on shogi_edge.head_to_head (player_b_id, player_a_id, match_date desc);

-- -----------------------------------------------------------------
-- matches (対局スケジュール)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.matches (
  id uuid primary key default gen_random_uuid(),
  match_date date not null,
  match_time text,                   -- 'HH:MM' or null
  tournament text not null,
  player_a_id uuid not null references shogi_edge.players(id) on delete restrict,
  player_b_id uuid not null references shogi_edge.players(id) on delete restrict,
  sente_id uuid references shogi_edge.players(id),  -- 先手 (未確定なら null)
  time_control text not null default 'one_day' check (time_control in ('long','one_day','fast','ultra_fast')),
  is_live boolean not null default false,
  live_url_shogi_or_jp text,
  live_url_abema text,
  live_url_premium text,
  status text not null default 'scheduled' check (status in ('scheduled','ongoing','finished','cancelled')),
  result_winner_id uuid references shogi_edge.players(id),
  is_amateur boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_a_id <> player_b_id)
);

create index if not exists matches_date_idx on shogi_edge.matches (match_date desc);
create index if not exists matches_live_idx on shogi_edge.matches (is_live, match_date);
create index if not exists matches_status_idx on shogi_edge.matches (status);

-- -----------------------------------------------------------------
-- predictions (予想記録)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references shogi_edge.matches(id) on delete cascade,
  predicted_winner_id uuid not null references shogi_edge.players(id),
  win_prob_a numeric(5,4) not null,
  win_prob_b numeric(5,4) not null,
  confidence int not null check (confidence between 1 and 5),
  summary text not null,
  reasoning_json jsonb not null,
  expected_openings jsonb,
  model_weights_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists predictions_match_idx on shogi_edge.predictions (match_id, created_at desc);

-- -----------------------------------------------------------------
-- prediction_results (的中/外れ記録)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.prediction_results (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null unique references shogi_edge.predictions(id) on delete cascade,
  actual_winner_id uuid not null references shogi_edge.players(id),
  is_correct boolean not null,
  finalized_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- weight_history (重み調整履歴)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.weight_history (
  id uuid primary key default gen_random_uuid(),
  weights_json jsonb not null,
  changed_by text,
  note text,
  changed_at timestamptz not null default now()
);

-- 初期重み (仕様書 §1.4 アルゴリズム)
insert into shogi_edge.weight_history (weights_json, changed_by, note)
values (
  '{"rating":0.30,"recent_1m":0.20,"head_to_head":0.15,"opening_match":0.15,"side":0.08,"tournament_time":0.07,"streak":0.05}'::jsonb,
  'system',
  '初期値 (仕様書 §1.4)'
)
on conflict do nothing;

-- -----------------------------------------------------------------
-- tournaments_amateur / amateur_results (アマ大会)
-- -----------------------------------------------------------------
create table if not exists shogi_edge.tournaments_amateur (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  match_date date not null,
  location text,
  prize_money text,
  has_live boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists shogi_edge.amateur_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references shogi_edge.tournaments_amateur(id) on delete cascade,
  amateur_id uuid not null references shogi_edge.amateurs(id) on delete cascade,
  rank int,
  opponents_json jsonb,
  notes text
);

-- =============================================================
-- RLS 設定
-- 方針:
--   * anon (公開) は読み取りのみ許可
--   * 書き込みは service_role (管理画面 API 経由) のみ
-- =============================================================

alter table shogi_edge.players enable row level security;
alter table shogi_edge.amateurs enable row level security;
alter table shogi_edge.player_stats enable row level security;
alter table shogi_edge.player_openings enable row level security;
alter table shogi_edge.head_to_head enable row level security;
alter table shogi_edge.matches enable row level security;
alter table shogi_edge.predictions enable row level security;
alter table shogi_edge.prediction_results enable row level security;
alter table shogi_edge.weight_history enable row level security;
alter table shogi_edge.tournaments_amateur enable row level security;
alter table shogi_edge.amateur_results enable row level security;

-- anon 読み取り許可
do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'shogi_edge' and table_type = 'BASE TABLE'
  loop
    execute format(
      'drop policy if exists "%1$s_anon_select" on shogi_edge.%1$I;', t
    );
    execute format(
      'create policy "%1$s_anon_select" on shogi_edge.%1$I for select to anon using (true);', t
    );
  end loop;
end $$;

-- service_role は元々 RLS バイパスするので明示ポリシー不要

-- =============================================================
-- updated_at 自動更新トリガー
-- =============================================================
create or replace function shogi_edge.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'shogi_edge' and column_name = 'updated_at'
  loop
    execute format(
      'drop trigger if exists set_updated_at on shogi_edge.%1$I;', t
    );
    execute format(
      'create trigger set_updated_at before update on shogi_edge.%1$I for each row execute function shogi_edge.set_updated_at();', t
    );
  end loop;
end $$;
