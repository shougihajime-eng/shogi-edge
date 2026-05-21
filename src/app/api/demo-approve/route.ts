// デモ用: 月次振り返りの重み調整提案を承認 → weight_history に新エントリ追加
import { NextResponse } from "next/server";
import { approveMonthlyProposal } from "@/lib/reflection/repository";

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || req.headers.get("x-admin-password") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    monthly_id?: string;
  } | null;
  if (!body?.monthly_id) {
    return NextResponse.json({ error: "monthly_id is required" }, { status: 400 });
  }
  try {
    await approveMonthlyProposal(body.monthly_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
