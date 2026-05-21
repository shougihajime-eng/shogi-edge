// デバッグ用: admin client での matches クエリが効くか確認
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
  const matches = await admin
    .from("matches")
    .select("id, match_date, tournament, status")
    .gte("match_date", start)
    .lte("match_date", end)
    .eq("status", "finished");

  return NextResponse.json({
    ok: true,
    start,
    end,
    matches_count: matches.data?.length ?? 0,
    matches_error: matches.error?.message ?? null,
    matches_sample: matches.data?.slice(0, 3) ?? [],
  });
}
