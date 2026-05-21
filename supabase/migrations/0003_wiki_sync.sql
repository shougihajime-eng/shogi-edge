-- =============================================================
-- Shogi Edge — Wikipedia/Wikidata 自動同期サポート
-- =============================================================
-- 目的:
--   * players テーブルに Wikidata QID / Wikipedia URL / 同期時刻カラムを追加
--   * 同期実行の履歴を wiki_sync_logs に記録
-- ライセンス: Wikipedia (CC-BY-SA 3.0) / Wikidata (CC0)
-- 取得方針: User-Agent 明示・1 req/sec・キャッシュ尊重 (API:Etiquette 準拠)

-- ---- players カラム拡張 ----
alter table shogi_edge.players
  add column if not exists wikidata_qid text;

alter table shogi_edge.players
  add column if not exists wikipedia_url text;

alter table shogi_edge.players
  add column if not exists wiki_synced_at timestamptz;

alter table shogi_edge.players
  add column if not exists player_number int;

alter table shogi_edge.players
  add column if not exists is_retired boolean not null default false;

create index if not exists players_wikidata_qid_idx on shogi_edge.players (wikidata_qid);
create index if not exists players_player_number_idx on shogi_edge.players (player_number);

-- ---- 同期ログ ----
create table if not exists shogi_edge.wiki_sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,                              -- 'wikipedia-player-list' 等
  source_url text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running','ok','partial','error')),
  players_created int not null default 0,
  players_updated int not null default 0,
  players_skipped int not null default 0,
  error_message text,
  detail_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wiki_sync_logs_started_idx
  on shogi_edge.wiki_sync_logs (started_at desc);

-- ---- RLS (anon は読み取りのみ) ----
alter table shogi_edge.wiki_sync_logs enable row level security;

drop policy if exists "wiki_sync_logs_anon_select" on shogi_edge.wiki_sync_logs;
create policy "wiki_sync_logs_anon_select"
  on shogi_edge.wiki_sync_logs for select to anon
  using (true);
