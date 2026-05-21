import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY が未設定です。");
}

// プロジェクト専用スキーマ shogi_edge にバインド
export function createBrowserSupabase() {
  return createClient(url ?? "https://example.invalid", anonKey ?? "anon", {
    db: { schema: "shogi_edge" },
    auth: { persistSession: false },
  });
}

export function createServerSupabase() {
  return createClient(url ?? "https://example.invalid", anonKey ?? "anon", {
    db: { schema: "shogi_edge" },
    auth: { persistSession: false },
  });
}
