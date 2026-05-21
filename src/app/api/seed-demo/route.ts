// =============================================================
// /api/seed-demo
//
// 一回だけ実行するシード用エンドポイント。
//   - プロ棋士 20 名を upsert (公開情報レベルの基本情報のみ)
//   - 各棋士の player_stats / player_openings をシード値で投入
//   - 主要ペア間の head_to_head をシード値で投入
//   - 5 件のデモ対局 (1週間先) を作成 + 予想生成
//
// すべて「シード値・要更新」の扱い。管理画面の CSV 取込で正確な値に差し替えてください。
// 認証: x-admin-password ヘッダで .env の ADMIN_PASSWORD と照合
// =============================================================

import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { regeneratePrediction } from "@/lib/prediction/repository";

interface SeedPlayer {
  name: string;
  kanji_name: string;
  rank: string;
  region: "tokyo" | "kansai" | null;
  master: string | null;
  rating: number;
  notes: string;
}

// 公開されている基本情報のみ。段位は時期によって変わるため、最新の公式表記に
// 合わせて随時 /admin/players で上書きしてください。レーティングは初期値で、
// 直接対戦・成績データを入れていくと自然に更新される設計です。
// シード対象: 公開情報レベルの基本情報のみ (名前 / 段位 / 所属 / 師匠)
// 段位は時期で変わるため、最新公式表記に合わせて /admin/players で随時更新する想定
const PLAYERS: SeedPlayer[] = [
  // タイトル経験者・トップ層
  { name: "藤井聡太", kanji_name: "藤井聡太", rank: "竜王・名人", region: "kansai", master: "杉本昌隆", rating: 2000, notes: "シード(2026-05)" },
  { name: "永瀬拓矢", kanji_name: "永瀬拓矢", rank: "九段", region: "tokyo", master: "安恵照剛", rating: 1880, notes: "シード(2026-05)" },
  { name: "渡辺明", kanji_name: "渡辺明", rank: "九段", region: "tokyo", master: "所司和晴", rating: 1860, notes: "シード(2026-05)" },
  { name: "豊島将之", kanji_name: "豊島将之", rank: "九段", region: "kansai", master: "桐山清澄", rating: 1840, notes: "シード(2026-05)" },
  { name: "羽生善治", kanji_name: "羽生善治", rank: "九段", region: "tokyo", master: "二上達也", rating: 1820, notes: "シード(2026-05)" },
  { name: "佐々木勇気", kanji_name: "佐々木勇気", rank: "八段", region: "tokyo", master: "石田和雄", rating: 1780, notes: "シード(2026-05)" },
  { name: "伊藤匠", kanji_name: "伊藤匠", rank: "七段", region: "tokyo", master: "宮田利男", rating: 1820, notes: "シード(2026-05)" },
  { name: "菅井竜也", kanji_name: "菅井竜也", rank: "八段", region: "kansai", master: "森信雄", rating: 1780, notes: "シード(2026-05) 振り飛車党" },
  { name: "斎藤慎太郎", kanji_name: "斎藤慎太郎", rank: "八段", region: "kansai", master: "畠山鎮", rating: 1750, notes: "シード(2026-05)" },
  { name: "稲葉陽", kanji_name: "稲葉陽", rank: "八段", region: "kansai", master: "井上慶太", rating: 1730, notes: "シード(2026-05)" },
  { name: "中村太地", kanji_name: "中村太地", rank: "八段", region: "tokyo", master: "米長邦雄", rating: 1700, notes: "シード(2026-05) 漢字「中村太地」厳守" },
  { name: "広瀬章人", kanji_name: "広瀬章人", rank: "九段", region: "tokyo", master: "勝浦修", rating: 1780, notes: "シード(2026-05)" },
  { name: "佐藤天彦", kanji_name: "佐藤天彦", rank: "九段", region: "tokyo", master: "中田功", rating: 1770, notes: "シード(2026-05)" },
  { name: "糸谷哲郎", kanji_name: "糸谷哲郎", rank: "八段", region: "kansai", master: "井上慶太", rating: 1740, notes: "シード(2026-05)" },
  { name: "山崎隆之", kanji_name: "山崎隆之", rank: "八段", region: "kansai", master: "森信雄", rating: 1700, notes: "シード(2026-05)" },
  { name: "千田翔太", kanji_name: "千田翔太", rank: "七段", region: "kansai", master: "森信雄", rating: 1720, notes: "シード(2026-05)" },
  { name: "近藤誠也", kanji_name: "近藤誠也", rank: "七段", region: "tokyo", master: "石田和雄", rating: 1700, notes: "シード(2026-05)" },
  { name: "増田康宏", kanji_name: "増田康宏", rank: "七段", region: "tokyo", master: "森下卓", rating: 1730, notes: "シード(2026-05)" },
  { name: "高見泰地", kanji_name: "高見泰地", rank: "七段", region: "tokyo", master: "石田和雄", rating: 1670, notes: "シード(2026-05)" },
  { name: "屋敷伸之", kanji_name: "屋敷伸之", rank: "九段", region: "tokyo", master: "花村元司", rating: 1690, notes: "シード(2026-05)" },
];

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  const got = req.headers.get("x-admin-password");
  if (!expected || got !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();

  // 1. players の upsert (name + kanji_name 一意制約あり)
  const { data: insertedPlayers, error: pErr } = await admin
    .from("players")
    .upsert(
      PLAYERS.map((p) => ({ ...p })),
      { onConflict: "name,kanji_name" },
    )
    .select("*");
  if (pErr) {
    return NextResponse.json({ stage: "players", error: pErr.message }, { status: 500 });
  }
  const pmap = new Map(
    (insertedPlayers as { id: string; name: string }[]).map((p) => [p.name, p.id]),
  );
  const fujii = pmap.get("藤井聡太");
  const nagase = pmap.get("永瀬拓矢");
  if (!fujii || !nagase) {
    return NextResponse.json({ error: "seed players not retrievable" }, { status: 500 });
  }

  // 1b. player_stats を投入 (シード値)
  //   * 直近1ヶ月: トップ層 (R1850+) は 6〜9勝 1〜3敗、中堅 (R1700-1850) は 4〜6勝 3〜5敗
  //   * 先手後手も同様の比率で按分
  //   * snapshot_date = 今日。再シードは upsert で更新
  const today = new Date().toISOString().slice(0, 10);
  const statsRows = PLAYERS.map((p) => {
    const tier = p.rating >= 1900 ? "top" : p.rating >= 1800 ? "high" : p.rating >= 1700 ? "mid" : "low";
    const tmpl =
      tier === "top"
        ? { r1m: [9, 1], r3m: [22, 5], r1y: [70, 18], total: [400, 110], season: [22, 6], streak: 4, sente: [0.7, 0.75], gote: [0.65, 0.7] }
        : tier === "high"
          ? { r1m: [7, 3], r3m: [18, 9], r1y: [55, 30], total: [350, 200], season: [18, 9], streak: 2, sente: [0.6, 0.65], gote: [0.55, 0.6] }
          : tier === "mid"
            ? { r1m: [5, 4], r3m: [14, 12], r1y: [42, 38], total: [280, 240], season: [14, 12], streak: 1, sente: [0.55, 0.6], gote: [0.5, 0.55] }
            : { r1m: [4, 5], r3m: [11, 14], r1y: [38, 42], total: [220, 230], season: [11, 14], streak: -1, sente: [0.5, 0.55], gote: [0.45, 0.5] };
    return {
      player_id: pmap.get(p.name),
      snapshot_date: today,
      total_wins: tmpl.total[0],
      total_losses: tmpl.total[1],
      recent_1m_wins: tmpl.r1m[0],
      recent_1m_losses: tmpl.r1m[1],
      recent_3m_wins: tmpl.r3m[0],
      recent_3m_losses: tmpl.r3m[1],
      recent_1y_wins: tmpl.r1y[0],
      recent_1y_losses: tmpl.r1y[1],
      season_wins: tmpl.season[0],
      season_losses: tmpl.season[1],
      current_streak: tmpl.streak,
      sente_wins: Math.round(tmpl.total[0] * tmpl.sente[0] * 0.55),
      sente_losses: Math.round(tmpl.total[1] * 0.5),
      gote_wins: Math.round(tmpl.total[0] * tmpl.gote[0] * 0.55),
      gote_losses: Math.round(tmpl.total[1] * 0.5),
      sennichite_count: 0,
      jishogi_count: 0,
    };
  });
  await admin
    .from("player_stats")
    .upsert(statsRows, { onConflict: "player_id,snapshot_date" });

  // 1c. player_openings (シード値・戦型傾向)
  //   居飛車党: ai_kakari/kakugawari/yagura が主力
  //   振り飛車党 (菅井): shikenbisha/gokigen が主力
  const isFurigoma = new Set(["菅井竜也"]);
  const isAttacker = new Set(["藤井聡太", "永瀬拓矢", "渡辺明", "豊島将之", "羽生善治", "伊藤匠"]); // 攻撃的居飛車党 = 角換わり多め
  const openingRows: {
    player_id: string;
    opening: string;
    side: "sente" | "gote" | null;
    wins: number;
    losses: number;
  }[] = [];
  for (const p of PLAYERS) {
    const pid = pmap.get(p.name);
    if (!pid) continue;
    const tier = p.rating >= 1900 ? 1.0 : p.rating >= 1800 ? 0.85 : p.rating >= 1700 ? 0.7 : 0.55;
    const base = (w: number, l: number) => ({
      wins: Math.max(1, Math.round(w * tier)),
      losses: Math.max(1, Math.round(l * (2 - tier))),
    });
    if (isFurigoma.has(p.name)) {
      openingRows.push(
        { player_id: pid, opening: "shikenbisha", side: null, ...base(18, 9) },
        { player_id: pid, opening: "gokigen", side: null, ...base(12, 6) },
        { player_id: pid, opening: "sankenbisha", side: null, ...base(8, 5) },
        { player_id: pid, opening: "ai_kakari", side: null, ...base(3, 3) },
      );
    } else if (isAttacker.has(p.name)) {
      openingRows.push(
        { player_id: pid, opening: "kakugawari", side: null, ...base(22, 8) },
        { player_id: pid, opening: "ai_kakari", side: null, ...base(15, 7) },
        { player_id: pid, opening: "yagura", side: null, ...base(8, 5) },
        { player_id: pid, opening: "yokofudori", side: null, ...base(5, 3) },
      );
    } else {
      openingRows.push(
        { player_id: pid, opening: "ai_kakari", side: null, ...base(12, 8) },
        { player_id: pid, opening: "kakugawari", side: null, ...base(10, 8) },
        { player_id: pid, opening: "yagura", side: null, ...base(8, 6) },
        { player_id: pid, opening: "shikenbisha", side: null, ...base(4, 4) },
      );
    }
  }
  await admin
    .from("player_openings")
    .upsert(openingRows, { onConflict: "player_id,opening,side" });

  // 1d. head_to_head (シード値) — 主要対戦カードに分布
  const h2hPairs: { a: string; b: string; aWins: number; bWins: number; openings: string[] }[] = [
    { a: "藤井聡太", b: "永瀬拓矢", aWins: 14, bWins: 6, openings: ["kakugawari", "ai_kakari", "yagura"] },
    { a: "藤井聡太", b: "渡辺明", aWins: 12, bWins: 5, openings: ["kakugawari", "ai_kakari"] },
    { a: "藤井聡太", b: "豊島将之", aWins: 10, bWins: 4, openings: ["ai_kakari", "kakugawari", "yokofudori"] },
    { a: "藤井聡太", b: "羽生善治", aWins: 6, bWins: 3, openings: ["ai_kakari", "kakugawari"] },
    { a: "藤井聡太", b: "伊藤匠", aWins: 4, bWins: 3, openings: ["kakugawari"] },
    { a: "永瀬拓矢", b: "渡辺明", aWins: 5, bWins: 4, openings: ["ai_kakari", "yagura"] },
    { a: "永瀬拓矢", b: "豊島将之", aWins: 4, bWins: 5, openings: ["kakugawari", "yagura"] },
    { a: "渡辺明", b: "豊島将之", aWins: 6, bWins: 7, openings: ["kakugawari", "ai_kakari"] },
    { a: "羽生善治", b: "渡辺明", aWins: 8, bWins: 12, openings: ["yagura", "kakugawari"] },
    { a: "菅井竜也", b: "羽生善治", aWins: 3, bWins: 4, openings: ["shikenbisha", "gokigen"] },
    { a: "豊島将之", b: "山崎隆之", aWins: 5, bWins: 2, openings: ["ai_kakari", "kakugawari"] },
    { a: "佐々木勇気", b: "伊藤匠", aWins: 3, bWins: 4, openings: ["kakugawari", "ai_kakari"] },
  ];
  const h2hRows: {
    player_a_id: string;
    player_b_id: string;
    match_date: string;
    tournament: string;
    opening: string;
    winner_id: string;
  }[] = [];
  let dateCursor = new Date(Date.UTC(2024, 0, 10));
  for (const pair of h2hPairs) {
    const aId = pmap.get(pair.a);
    const bId = pmap.get(pair.b);
    if (!aId || !bId) continue;
    for (let i = 0; i < pair.aWins; i++) {
      h2hRows.push({
        player_a_id: aId,
        player_b_id: bId,
        match_date: dateCursor.toISOString().slice(0, 10),
        tournament: "シード対戦履歴",
        opening: pair.openings[i % pair.openings.length],
        winner_id: aId,
      });
      dateCursor = new Date(dateCursor.getTime() + 18 * 86400000);
    }
    for (let i = 0; i < pair.bWins; i++) {
      h2hRows.push({
        player_a_id: aId,
        player_b_id: bId,
        match_date: dateCursor.toISOString().slice(0, 10),
        tournament: "シード対戦履歴",
        opening: pair.openings[i % pair.openings.length],
        winner_id: bId,
      });
      dateCursor = new Date(dateCursor.getTime() + 18 * 86400000);
    }
  }
  // 重複防止: 既に「シード対戦履歴」がある場合は全削除して入れ直し
  await admin.from("head_to_head").delete().eq("tournament", "シード対戦履歴");
  if (h2hRows.length > 0) {
    await admin.from("head_to_head").insert(h2hRows);
  }

  // 2. デモ対局を複数作成 (or 再シード時はスキップ)
  const demoMatches: {
    daysAhead: number;
    time: string;
    tournament: string;
    time_control: "long" | "one_day" | "fast" | "ultra_fast";
    a: string;
    b: string;
    sente: "a" | "b";
  }[] = [
    { daysAhead: 3, time: "10:00", tournament: "デモ予想カード", time_control: "long", a: "藤井聡太", b: "永瀬拓矢", sente: "a" },
    { daysAhead: 4, time: "10:00", tournament: "デモ予想カード 第2局", time_control: "long", a: "渡辺明", b: "豊島将之", sente: "b" },
    { daysAhead: 5, time: "14:00", tournament: "デモ予想カード 早指し", time_control: "fast", a: "伊藤匠", b: "佐々木勇気", sente: "a" },
    { daysAhead: 6, time: "10:00", tournament: "デモ予想カード 振り飛車決戦", time_control: "one_day", a: "菅井竜也", b: "羽生善治", sente: "a" },
    { daysAhead: 7, time: "10:00", tournament: "デモ予想カード 関西所属対決", time_control: "one_day", a: "豊島将之", b: "山崎隆之", sente: "b" },
  ];

  const results: { match_id: string; predicted_winner: string; win_prob: number; confidence: number }[] = [];

  for (const dm of demoMatches) {
    const aId = pmap.get(dm.a);
    const bId = pmap.get(dm.b);
    if (!aId || !bId) continue;

    const matchDate = futureDate(dm.daysAhead);
    let matchId: string;
    const { data: existing } = await admin
      .from("matches")
      .select("id")
      .eq("match_date", matchDate)
      .eq("tournament", dm.tournament)
      .maybeSingle();

    if (existing && (existing as { id: string }).id) {
      matchId = (existing as { id: string }).id;
    } else {
      const { data: newMatch, error: mErr } = await admin
        .from("matches")
        .insert({
          match_date: matchDate,
          match_time: dm.time,
          tournament: dm.tournament,
          player_a_id: aId,
          player_b_id: bId,
          sente_id: dm.sente === "a" ? aId : bId,
          time_control: dm.time_control,
          is_live: true,
          is_amateur: false,
          notes: "シードデータ — 管理画面で削除・差し替え可能",
        })
        .select("id")
        .single();
      if (mErr) {
        return NextResponse.json({ stage: `match:${dm.tournament}`, error: mErr.message }, { status: 500 });
      }
      matchId = (newMatch as { id: string }).id;
    }

    try {
      const prediction = await regeneratePrediction(matchId);
      results.push({
        match_id: matchId,
        predicted_winner: prediction.predicted_winner_id === aId ? dm.a : dm.b,
        win_prob: prediction.predicted_winner_id === aId ? prediction.win_prob_a : prediction.win_prob_b,
        confidence: prediction.confidence,
      });
    } catch (e) {
      return NextResponse.json(
        { stage: `prediction:${dm.tournament}`, error: e instanceof Error ? e.message : "unknown" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    players: insertedPlayers?.length ?? 0,
    matches: results.length,
    predictions: results,
  });
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}
