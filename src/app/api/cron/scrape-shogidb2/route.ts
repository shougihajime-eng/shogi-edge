// B層スクレイパー: 将棋DB2 (個人運営・要事前連絡)
import { NextResponse } from "next/server";
const ENABLED = false;
export async function GET() {
  return NextResponse.json({
    enabled: ENABLED,
    message: "将棋DB2 は事前連絡推奨のため OFF",
  });
}
