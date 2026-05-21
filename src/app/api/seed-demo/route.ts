// =============================================================
// /api/seed-demo
//
// 一回だけ実行するシード用エンドポイント。
//   - 公開情報レベルのプロ棋士 6 名を upsert
//   - 1 件のデモ対局 (1週間先) を作成
//   - 予想を生成 (信頼度は★1〜2 想定 — h2h/成績データが空のため意図通り)
//
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
