import "server-only";
import type {
  ExpectedOpeningDistribution,
  HeadToHead,
  Match,
  Player,
  Prediction,
} from "@/types/db";
import { createAdminSupabase } from "@/lib/supabase/admin";

// =============================================================
// 弱点パターン DB (仕様書 §9.5)
// 「振り飛車_若手_早指し」のようなキーで外し率を蓄積
// 結果確定時に毎回 upsert され、外し率が高いパターンは confidence_penalty が上がる
// =============================================================

const YOUNG_AGE_THRESHOLD = 27; // 27歳以下を「若手」と扱う (順位戦昇級ラインを参考)

export function buildPatternKeys(args: {
  prediction: Prediction;
  match: Match;
  player_a: Player;
  player_b: Player;
}): string[] {
  const { prediction, match, player_a, player_b } = args;
  const keys: string[] = [];

  // 戦型ベース
  const topOpening = topExpectedOpening(prediction);
  if (topOpening) {
    keys.push(`戦型_${topOpening}`);
  }

  // 棋戦・持ち時間
  keys.push(`持ち時間_${match.time_control}`);

  // 若手対戦か
  const youthA = isYoung(player_a);
  const youthB = isYoung(player_b);
  if (youthA && youthB) keys.push("若手同士");
  else if (youthA || youthB) keys.push("若手vsベテラン");

  // アマ
  if (match.is_amateur) keys.push("アマ対局");

  // 複合パターン (上位)
  if (topOpening && (youthA || youthB)) {
    keys.push(`戦型_${topOpening}_若手絡み_${match.time_control}`);
  }

  return keys;
}

function topExpectedOpening(prediction: Prediction): string | null {
  if (!prediction.expected_openings) return null;
  const entries = Object.entries(prediction.expected_openings);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] >= 0.3 ? entries[0][0] : null;
}

// 予想生成前 (= まだ Prediction 行がない時) でもパターンキーを引けるバリアント
// match + 両棋士 + 直接対戦履歴から戦型分布を組み立てる
export function buildPatternKeysFromInputs(args: {
  match: Match;
  player_a: Player;
  player_b: Player;
  expected_openings: ExpectedOpeningDistribution | null;
}): string[] {
  const { match, player_a, player_b, expected_openings } = args;
  const fakePrediction = {
    expected_openings,
  } as unknown as Prediction;
  return buildPatternKeys({
    prediction: fakePrediction,
    match,
    player_a,
    player_b,
  });
}

// h2h 配列から戦型分布を再構成 (engine.ts と同じロジックを再実装)
export function expectedOpeningsFromHeadToHead(
  h2h: HeadToHead[],
): ExpectedOpeningDistribution {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const h of h2h.slice(0, 20)) {
    if (!h.opening) continue;
    counts[h.opening] = (counts[h.opening] ?? 0) + 1;
    total += 1;
  }
  if (total === 0) return {};
  const dist: ExpectedOpeningDistribution = {};
  for (const [k, v] of Object.entries(counts)) {
    dist[k] = v / total;
  }
  return dist;
}

function isYoung(p: Player): boolean {
  if (!p.birth_date) return false;
  const birth = new Date(p.birth_date);
  const now = new Date();
  const age = (now.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
  return age <= YOUNG_AGE_THRESHOLD;
}

// パターンの累計を更新
export async function updateWeaknessPatterns(args: {
  patternKeys: string[];
  is_correct: boolean;
}) {
  if (args.patternKeys.length === 0) return;
  const admin = createAdminSupabase();
  for (const key of args.patternKeys) {
    const { data: existing } = await admin
      .from("weakness_patterns")
      .select("*")
      .eq("pattern_key", key)
      .maybeSingle();
    if (existing) {
      const e = existing as unknown as {
        id: string;
        total_attempts: number;
        miss_count: number;
      };
      const total = e.total_attempts + 1;
      const miss = e.miss_count + (args.is_correct ? 0 : 1);
      const missRate = miss / total;
      // 5サンプル以上で外し率 50% 超なら ★-1、70% 超なら ★-2
      let penalty = 0;
      if (total >= 5 && missRate >= 0.7) penalty = 2;
      else if (total >= 5 && missRate >= 0.5) penalty = 1;
      await admin
        .from("weakness_patterns")
        .update({
          total_attempts: total,
          miss_count: miss,
          confidence_penalty: penalty,
          last_updated: new Date().toISOString(),
        })
        .eq("id", e.id);
    } else {
      await admin.from("weakness_patterns").insert({
        pattern_key: key,
        total_attempts: 1,
        miss_count: args.is_correct ? 0 : 1,
        confidence_penalty: 0,
      });
    }
  }
}

// 予想時にパターンマッチして信頼度ペナルティを取得
export async function calcConfidencePenalty(args: {
  patternKeys: string[];
}): Promise<{ penalty: number; matched: { key: string; penalty: number; total_attempts: number; miss_count: number }[] }> {
  if (args.patternKeys.length === 0) return { penalty: 0, matched: [] };
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("weakness_patterns")
    .select("*")
    .in("pattern_key", args.patternKeys)
    .gt("confidence_penalty", 0);
  const rows = ((data ?? []) as unknown as {
    pattern_key: string;
    confidence_penalty: number;
    total_attempts: number;
    miss_count: number;
  }[]) ?? [];
  const max = rows.reduce((m, r) => Math.max(m, r.confidence_penalty), 0);
  return {
    penalty: max,
    matched: rows.map((r) => ({
      key: r.pattern_key,
      penalty: r.confidence_penalty,
      total_attempts: r.total_attempts,
      miss_count: r.miss_count,
    })),
  };
}
