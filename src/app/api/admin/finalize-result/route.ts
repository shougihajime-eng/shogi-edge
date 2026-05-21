// =============================================================
// /api/admin/finalize-result — プログラム実行用の結果確定エンドポイント
//
// 用途: 管理画面にログインしなくても、合言葉ヘッダ付き POST で
//       対局結果を確定 + 振り返り自動生成 + 弱点パターン更新を実行
//
// 認証: x-admin-password ヘッダで .env の ADMIN_PASSWORD と照合
// 入力 (JSON): { match_id: string, winner_id: string }
// 出力: { ok, match_id, winner_id, reflection: {is_correct, result_summary, honest_review, lesson_learned, factor_attribution_json} }
// =============================================================

import { NextResponse } from "next/server";
import { finalizeMatchResult } from "@/lib/prediction/repository";
import { loadReflectionByMatch } from "@/lib/reflection/repository";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  const got = req.headers.get("x-admin-password");
  if (!expected || got !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { match_id?: string; winner_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const matchId = body.match_id;
  const winnerId = body.winner_id;
  if (!matchId || !winnerId) {
    return NextResponse.json(
      { error: "match_id と winner_id が必須" },
      { status: 400 },
    );
  }
  try {
    await finalizeMatchResult(matchId, winnerId);
    const reflection = await loadReflectionByMatch(matchId);
    return NextResponse.json({
      ok: true,
      match_id: matchId,
      winner_id: winnerId,
      reflection,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
