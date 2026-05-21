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
const PLAYERS: SeedPlayer[] = [
  {
    name: "藤井聡太",
    kanji_name: "藤井聡太",
    rank: "竜王・名人",
    region: "kansai",
    master: "杉本昌隆",
    rating: 2000,
    notes: "シード(2026-05): 段位・タイトル状況は最新公式表記に合わせて更新",
  },
  {
    name: "永瀬拓矢",
    kanji_name: "永瀬拓矢",
    rank: "九段",
    region: "tokyo",
    master: "安恵照剛",
    rating: 1880,
    notes: "シード(2026-05): 段位は最新公式表記で更新",
  },
  {
    name: "渡辺明",
    kanji_name: "渡辺明",
    rank: "九段",
    region: "tokyo",
    master: "所司和晴",
    rating: 1840,
    notes: "シード(2026-05): 段位は最新公式表記で更新",
  },
  {
    name: "豊島将之",
    kanji_name: "豊島将之",
    rank: "九段",
    region: "kansai",
    master: "桐山清澄",
    rating: 1830,
    notes: "シード(2026-05): 段位は最新公式表記で更新",
  },
  {
    name: "羽生善治",
    kanji_name: "羽生善治",
    rank: "九段",
    region: "tokyo",
    master: "二上達也",
    rating: 1810,
    notes: "シード(2026-05): 段位は最新公式表記で更新",
  },
  {
    name: "中村太地",
    kanji_name: "中村太地",
    rank: "八段",
    region: "tokyo",
    master: "米長邦雄",
    rating: 1700,
    notes:
      "シード(2026-05): 漢字「中村太地」を必ず正確に。段位は最新公式表記で更新",
  },
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

  // 2. 既存のデモ対局があれば一旦取得、無ければ作る
  const demoDate = nextWednesday();
  let matchId: string;
  const { data: existing } = await admin
    .from("matches")
    .select("id")
    .eq("match_date", demoDate)
    .eq("tournament", "デモ予想カード")
    .maybeSingle();

  if (existing && (existing as { id: string }).id) {
    matchId = (existing as { id: string }).id;
  } else {
    const { data: newMatch, error: mErr } = await admin
      .from("matches")
      .insert({
        match_date: demoDate,
        match_time: "10:00",
        tournament: "デモ予想カード",
        player_a_id: fujii,
        player_b_id: nagase,
        sente_id: fujii,
        time_control: "long",
        is_live: true,
        live_url_shogi_or_jp: null,
        is_amateur: false,
        notes: "シードデータ — 管理画面で削除・差し替え可能",
      })
      .select("id")
      .single();
    if (mErr) {
      return NextResponse.json({ stage: "match", error: mErr.message }, { status: 500 });
    }
    matchId = (newMatch as { id: string }).id;
  }

  // 3. 予想を生成
  let prediction;
  try {
    prediction = await regeneratePrediction(matchId);
  } catch (e: unknown) {
    return NextResponse.json(
      {
        stage: "prediction",
        error: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    players: insertedPlayers?.length ?? 0,
    match_id: matchId,
    prediction: {
      id: prediction.id,
      confidence: prediction.confidence,
      win_prob_a: prediction.win_prob_a,
      win_prob_b: prediction.win_prob_b,
      summary: prediction.summary,
    },
  });
}

function nextWednesday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((10 - d.getDay()) % 7 || 7)); // 次の水曜
  return d.toISOString().slice(0, 10);
}
