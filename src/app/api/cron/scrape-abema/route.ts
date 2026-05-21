// B層スクレイパー: ABEMA 将棋番組表 (規約上 OFF 推奨)
import { NextResponse } from "next/server";
const ENABLED = false;
export async function GET() {
  return NextResponse.json({ enabled: ENABLED, message: "ABEMA は規約により OFF 推奨" });
}
