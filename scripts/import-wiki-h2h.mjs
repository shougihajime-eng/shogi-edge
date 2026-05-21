// Wikipedia 由来の直接対戦 CSV を本番 DB に投入する 1-shot スクリプト
// 使い方: node --env-file=.env.local scripts/import-wiki-h2h.mjs
//
// - 棋士名はすべて name で照合 (CSV 内の棋士は事前に players テーブルに登録されている前提)
// - 重複防止: (player_a_id, player_b_id, match_date, tournament) の組が既存なら skip
//   逆順も含めて判定 (誰が a/b かは順位戦記事の表記順に依存するため)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です");
  process.exit(1);
}

const sb = createClient(url, key, {
  db: { schema: "shogi_edge" },
  auth: { persistSession: false, autoRefreshToken: false },
});

const csvPath = resolve(process.cwd(), "data/head_to_head_wikipedia.csv");
const text = readFileSync(csvPath, "utf8");

// 簡易 CSV パース (#コメントは無視)
function parseCsv(t) {
  const rows = [];
  for (const raw of t.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else if (c === ",") { out.push(cur); cur = ""; }
      else if (c === '"' && cur === "") inQ = true;
      else cur += c;
    }
    out.push(cur);
    rows.push(out.map((s) => s.trim()));
  }
  return rows;
}

const rows = parseCsv(text);
console.log(`📋 CSV 行数: ${rows.length}`);

// 棋士マップ
const { data: players, error: pErr } = await sb.from("players").select("id, name");
if (pErr) {
  console.error("players 取得失敗:", pErr.message);
  process.exit(1);
}
const nameToId = new Map(players.map((p) => [p.name, p.id]));
console.log(`👤 登録棋士: ${players.length}名`);

// 未登録棋士の検出
const missing = new Set();
for (const r of rows) {
  const [, a, b, , , winner] = r;
  if (a && !nameToId.has(a)) missing.add(a);
  if (b && !nameToId.has(b)) missing.add(b);
  if (winner && !nameToId.has(winner)) missing.add(winner);
}
if (missing.size > 0) {
  console.log(`⚠️ 未登録棋士 ${missing.size}名 (本投入はスキップ):`);
  for (const n of missing) console.log(`   - ${n}`);
}

// 既存対戦の取得
const { data: existingRaw } = await sb
  .from("head_to_head")
  .select("player_a_id, player_b_id, match_date, tournament")
  .gte("match_date", "2019-01-01");
const existSet = new Set(
  (existingRaw ?? []).map((e) => `${e.player_a_id}|${e.player_b_id}|${e.match_date}|${e.tournament}`),
);
console.log(`📌 既存対戦: ${existingRaw?.length ?? 0}件`);

const toInsert = [];
let skipped_missing = 0;
let skipped_dup = 0;
for (const r of rows) {
  const [date, a, b, tname, opening, winner, kifu] = r;
  if (!date || !a || !b || !tname) { skipped_missing++; continue; }
  const aId = nameToId.get(a);
  const bId = nameToId.get(b);
  if (!aId || !bId) { skipped_missing++; continue; }
  const winnerId = winner ? nameToId.get(winner) : null;
  const key1 = `${aId}|${bId}|${date}|${tname}`;
  const key2 = `${bId}|${aId}|${date}|${tname}`;
  if (existSet.has(key1) || existSet.has(key2)) { skipped_dup++; continue; }
  toInsert.push({
    player_a_id: aId,
    player_b_id: bId,
    match_date: date,
    tournament: tname,
    opening: opening || null,
    winner_id: winnerId,
    kifu_url: kifu || null,
  });
  // 同一バッチ内の重複も予防
  existSet.add(key1);
}

console.log(`\n=== 投入計画 ===`);
console.log(`  追加: ${toInsert.length}局`);
console.log(`  既存スキップ: ${skipped_dup}局`);
console.log(`  名前未登録スキップ: ${skipped_missing}局`);

if (toInsert.length > 0) {
  // バッチ insert (Supabase は 1 リクエスト 100 行制限のため 100 件ずつ)
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    const { error } = await sb.from("head_to_head").insert(batch);
    if (error) {
      console.error(`❌ batch ${i}-${i + batch.length} insert error:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
  }
  console.log(`\n✅ 投入完了: ${inserted}局`);
} else {
  console.log("\n(投入する対戦はありません)");
}

// 棋戦別の最終件数
const { data: finalCounts } = await sb
  .from("head_to_head")
  .select("tournament", { count: "exact" });
const counts = {};
for (const row of finalCounts ?? []) {
  counts[row.tournament] = (counts[row.tournament] ?? 0) + 1;
}
console.log("\n=== head_to_head の最終内訳 (件数) ===");
for (const [t, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t}: ${c}`);
}
