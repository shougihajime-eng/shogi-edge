import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// 管理画面の合言葉認証 (シンプル Cookie)
const COOKIE_NAME = "shogi_edge_admin";
const SECRET_PEPPER = "shogi-edge-v1";

// 簡易ハッシュ (timing attack 厳密性は不要、shared secret モデル)
async function hash(input: string): Promise<string> {
  const enc = new TextEncoder().encode(SECRET_PEPPER + input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function loginWithPassword(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD が .env.local に設定されていません");
  }
  if (password !== expected) return false;
  const token = await hash(expected);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return true;
}

export async function logout() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const expectedHash = await hash(expected);
  const store = await cookies();
  const got = store.get(COOKIE_NAME)?.value;
  return got === expectedHash;
}

export async function requireAdmin() {
  const ok = await isAuthenticated();
  if (!ok) {
    redirect("/admin/login");
  }
}
