import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { fetchWikipediaParsed } from "./client";
import {
  parseShogiPlayerListHtml,
  type ParsedPlayer,
} from "./parser";

// =============================================================
// Wikipedia 「将棋棋士一覧」→ shogi_edge.players 同期
// 方針:
//   * 新規棋士: 段位・出身・師匠・生年月日・Wikipedia URL を投入 (rating はデフォルト 1500)
//   * 既存棋士: kanji_name 一致で UPDATE。
//     更新するのは rank / region / master / birth_date / wikipedia_url / wikidata_qid / player_number / is_retired / wiki_synced_at
//     **rating は手で調整した値を尊重するため上書きしない**
//   * 物故・退会棋士: is_retired=true でマーク (削除はしない)
//   * すべての結果は wiki_sync_logs に記録
// ライセンス:
//   * 取得元 Wikipedia は CC-BY-SA 3.0。出典として
//     https://ja.wikipedia.org/wiki/将棋棋士一覧 を本アプリ内 (棋士プロフィール画面など) に明記すること
// =============================================================

const SOURCE_KEY = "wikipedia-player-list";
const SOURCE_URL =
  "https://ja.wikipedia.org/wiki/%E5%B0%86%E6%A3%8B%E6%A3%8B%E5%A3%AB%E4%B8%80%E8%A6%A7";

export interface WikiSyncResult {
  log_id: string;
  total_extracted: number;
  active_extracted: number;
  players_created: number;
  players_updated: number;
  players_skipped: number;
  warnings: string[];
  status: "ok" | "partial" | "error";
  error_message: string | null;
  sample_changes: string[];
}

function regionToCode(text: string | null): "tokyo" | "kansai" | null {
  if (!text) return null;
  // 関東圏は tokyo、関西圏は kansai に荒くマッピング
  const kansai = ["大阪", "兵庫", "京都", "奈良", "和歌山", "滋賀"];
  if (kansai.some((k) => text.includes(k))) return "kansai";
  return "tokyo";
}

export async function syncPlayersFromWikipedia(): Promise<WikiSyncResult> {
  const sb = createAdminSupabase();

  // 1) ログレコードを開始状態で作成
  const { data: logRow, error: logError } = await sb
    .from("wiki_sync_logs")
    .insert({
      source: SOURCE_KEY,
      source_url: SOURCE_URL,
      status: "running",
    })
    .select("id")
    .single();
  if (logError || !logRow) {
    throw new Error(
      `wiki_sync_logs への INSERT に失敗: ${logError?.message ?? "row null"}`,
    );
  }
  const logId = logRow.id as string;

  const sampleChanges: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let activeExtracted = 0;
  let totalExtracted = 0;
  let warnings: string[] = [];
  let status: "ok" | "partial" | "error" = "ok";
  let errorMessage: string | null = null;
  let players: ParsedPlayer[] = [];

  try {
    const { html } = await fetchWikipediaParsed("将棋棋士一覧");
    const parseResult = parseShogiPlayerListHtml(html);
    players = parseResult.players;
    warnings = parseResult.warnings;
    totalExtracted = players.length;
    activeExtracted = players.filter((p) => p.is_active).length;

    if (totalExtracted === 0) {
      throw new Error(
        "Wikipedia から棋士行が 1 件も抽出できませんでした (パーサー要修正)",
      );
    }

    // 2) 既存棋士を全て取得 (kanji_name でマッピング)
    const { data: existing, error: exErr } = await sb
      .from("players")
      .select("id, kanji_name, rank, region, master, birth_date, wikipedia_url");
    if (exErr) {
      throw new Error(`players SELECT 失敗: ${exErr.message}`);
    }
    const existingByName = new Map<
      string,
      {
        id: string;
        kanji_name: string;
        rank: string;
        region: "tokyo" | "kansai" | null;
        master: string | null;
        birth_date: string | null;
        wikipedia_url: string | null;
      }
    >();
    for (const e of existing ?? []) {
      existingByName.set(e.kanji_name, e);
    }

    const nowIso = new Date().toISOString();

    // 3) 棋士ごとに upsert
    for (const p of players) {
      const wikipediaUrl = p.wikipedia_path
        ? `https://ja.wikipedia.org${p.wikipedia_path}`
        : null;
      const region = regionToCode(p.birth_region);
      const isRetired = !p.is_active;

      const existingRow = existingByName.get(p.kanji_name);
      if (existingRow) {
        // 既存: 差分があれば update
        const patch: Record<string, unknown> = {
          player_number: p.player_number,
          wikipedia_url: wikipediaUrl,
          wiki_synced_at: nowIso,
          is_retired: isRetired,
        };
        const changes: string[] = [];
        if (existingRow.rank !== p.current_rank) {
          patch.rank = p.current_rank;
          changes.push(`段位 ${existingRow.rank}→${p.current_rank}`);
        }
        if (!existingRow.birth_date && p.birth_date_iso) {
          patch.birth_date = p.birth_date_iso;
        }
        if (!existingRow.master && p.master) {
          patch.master = p.master;
        }
        if (!existingRow.region && region) {
          patch.region = region;
        }
        const { error: uErr } = await sb
          .from("players")
          .update(patch)
          .eq("id", existingRow.id);
        if (uErr) {
          warnings.push(
            `UPDATE 失敗 ${p.kanji_name}: ${uErr.message}`,
          );
          skippedCount++;
        } else {
          updatedCount++;
          if (changes.length > 0 && sampleChanges.length < 10) {
            sampleChanges.push(`${p.kanji_name}: ${changes.join(", ")}`);
          }
        }
      } else {
        // 新規: 投入
        const insertRow: Record<string, unknown> = {
          name: p.kanji_name,
          kanji_name: p.kanji_name,
          rank: p.current_rank,
          birth_date: p.birth_date_iso,
          master: p.master,
          region,
          rating: 1500, // 初期値 (手で調整するまでの暫定)
          player_number: p.player_number,
          wikipedia_url: wikipediaUrl,
          wiki_synced_at: nowIso,
          is_retired: isRetired,
          notes: `Wikipedia 自動取得 (${SOURCE_URL})`,
        };
        const { error: iErr } = await sb.from("players").insert(insertRow);
        if (iErr) {
          // unique 制約 (name+kanji_name) で衝突する可能性 → 同名別人や typo
          warnings.push(`INSERT 失敗 ${p.kanji_name}: ${iErr.message}`);
          skippedCount++;
        } else {
          createdCount++;
          if (sampleChanges.length < 10) {
            sampleChanges.push(
              `${p.kanji_name} (新規 / ${p.current_rank} / ${p.birth_region ?? "?"})`,
            );
          }
        }
      }
    }

    if (warnings.length > 0) {
      status = "partial";
    }
  } catch (e) {
    status = "error";
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  // 4) ログを finalize
  await sb
    .from("wiki_sync_logs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      players_created: createdCount,
      players_updated: updatedCount,
      players_skipped: skippedCount,
      error_message: errorMessage,
      detail_json: {
        total_extracted: totalExtracted,
        active_extracted: activeExtracted,
        warnings,
        sample_changes: sampleChanges,
      },
    })
    .eq("id", logId);

  return {
    log_id: logId,
    total_extracted: totalExtracted,
    active_extracted: activeExtracted,
    players_created: createdCount,
    players_updated: updatedCount,
    players_skipped: skippedCount,
    warnings,
    status,
    error_message: errorMessage,
    sample_changes: sampleChanges,
  };
}
