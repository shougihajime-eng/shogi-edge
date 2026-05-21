import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

// service_role は RLS をバイパス。サーバ側だけで使用
export function createAdminSupabase() {
  if (!url || !serviceRole) {
    throw new Error(
      "Supabase admin client は SUPABASE_SERVICE_ROLE_KEY が必須です (.env.local を確認)",
    );
  }
  return createClient(url, serviceRole, {
    db: { schema: "shogi_edge" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
