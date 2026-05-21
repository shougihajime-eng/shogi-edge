// デバッグ用: aggregate.ts の loadPeriodData をフルにトレース
import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || req.headers.get("x-admin-password") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const start = url.searchParams.get("start") ?? "2026-05-25";
  const end = url.searchParams.get("end") ?? "2026-05-31";

  const admin = createAdminSupabase();

  // 1) matches
  const m = await admin
    .from("matches")
    .select("id, match_date, status")
    .gte("match_date", start)
    .lte("match_date", end)
    .eq("status", "finished");
  const matches = m.data ?? [];

  if (matches.length === 0) {
    return NextResponse.json({ stage: "no_matches", start, end });
  }
  const matchIds = matches.map((x: { id: string }) => x.id);

  // 2) predictions
  const p = await admin.from("predictions").select("*").in("match_id", matchIds);
  const preds = p.data ?? [];

  // 3) prediction_results
  const predIds = preds.map((x: { id: string }) => x.id);
  const r = await admin
    .from("prediction_results")
    .select("*")
    .in("prediction_id", predIds);
  const results = r.data ?? [];

  return NextResponse.json({
    ok: true,
    start,
    end,
    matches_count: matches.length,
    matches_error: m.error?.message ?? null,
    preds_count: preds.length,
    preds_error: p.error?.message ?? null,
    results_count: results.length,
    results_error: r.error?.message ?? null,
    sample_match: matches[0],
    sample_pred_match_id: preds[0] ? (preds[0] as { match_id: string }).match_id : null,
    sample_result_pred_id: results[0] ? (results[0] as { prediction_id: string }).prediction_id : null,
  });
}
