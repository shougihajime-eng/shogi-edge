// =============================================================
// /api/demo-finalize
// デモ用: 対局を「終局」にして勝者を確定 → 自己学習を発火させる動作確認用
// 通常は /admin/results から行う。これは「curl で 1 発で発火確認」のため。
//
// 認証: x-admin-password ヘッダ
// =============================================================

import { NextResponse } from "next/server";
import { finalizeMatchResult } from "@/lib/prediction/repository";

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || req.headers.get("x-admin-password") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    match_id?: string;
    winner_id?: string;
  } | null;
  if (!body?.match_id || !body?.winner_id) {
    return NextResponse.json(
      { error: "match_id and winner_id are required" },
      { status: 400 },
    );
  }

  try {
    await finalizeMatchResult(body.match_id, body.winner_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
