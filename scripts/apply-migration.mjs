// 共有 Supabase の Management API を使って supabase/migrations/*.sql を順番に適用する
// 使い方: node scripts/apply-migration.mjs [migration-file]
//   未指定なら supabase/migrations/ 配下を全部適用 (ファイル名昇順)

import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "eqkaaohdbqefuszxwqzr";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("❌ 環境変数 SUPABASE_ACCESS_TOKEN が必要です");
  process.exit(1);
}

const args = process.argv.slice(2);
const dir = resolve(process.cwd(), "supabase/migrations");

const files =
  args.length > 0
    ? args.map((f) => resolve(process.cwd(), f))
    : (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort().map((f) => join(dir, f));

if (files.length === 0) {
  console.error("マイグレーションファイルが見つかりません");
  process.exit(1);
}

for (const file of files) {
  const sql = await readFile(file, "utf8");
  console.log(`\n📦 applying: ${file} (${sql.length} chars)`);
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await r.text();
  if (!r.ok) {
    console.error(`❌ ${r.status} ${r.statusText}`);
    console.error(text);
    process.exit(1);
  }
  console.log(`✅ OK (${text.length} bytes response)`);
}
console.log("\n🎉 done");
