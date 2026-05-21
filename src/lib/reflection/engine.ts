import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  FactorAttribution,
  Match,
  Player,
  Prediction,
  WeightSet,
} from "@/types/db";

// =============================================================
// Shogi Edge — 振り返り生成 (仕様書 §9.2)
// =============================================================
// 入力: 終局済みの prediction + match + 両棋士 + 実際の勝者
// 出力: result_summary / honest_review / lesson_learned / factor_attribution[]
//
// 口調: フランク・言い訳しない・テンプレ調禁止 (はじめ先生の口調)
// API キー未設定時はフォールバック (事実ベースの素の文。推測は書かない)

const FACTOR_TO_WEIGHT_KEY: Record<string, keyof WeightSet> = {
  レーティング差: "rating",
  直近1ヶ月成績: "recent_1m",
  直接対戦: "head_to_head",
  戦型相性: "opening_match",
  手番: "side",
  "棋戦・持ち時間": "tournament_time",
  調子: "streak",
};

export interface ReflectionInput {
  match: Match;
  prediction: Prediction;
  player_a: Player;
  player_b: Player;
  actual_winner_id: string;
}

export interface ReflectionOutput {
  is_correct: boolean;
  result_summary: string;
  honest_review: string;
  lesson_learned: string;
  factor_attribution_json: FactorAttribution[];
}

export async function generateMatchReflection(
  input: ReflectionInput,
): Promise<ReflectionOutput> {
  const { match, prediction, player_a, player_b, actual_winner_id } = input;
  const is_correct = prediction.predicted_winner_id === actual_winner_id;
  const winner = actual_winner_id === player_a.id ? player_a : player_b;
  const loser = actual_winner_id === player_a.id ? player_b : player_a;
  const winnerIsA = actual_winner_id === player_a.id;

  // 7要素の答え合わせ
  const factor_attribution_json: FactorAttribution[] = prediction.reasoning_json.map((r) => {
    const weightKey = FACTOR_TO_WEIGHT_KEY[r.factor];
    const weight = weightKey ? prediction.model_weights_json[weightKey] : 0;
    // impact_num が +なら a 寄り、 -なら b 寄り
    let had_correct_signal = false;
    if (r.impact_num > 0.001) had_correct_signal = winnerIsA;
    else if (r.impact_num < -0.001) had_correct_signal = !winnerIsA;
    else had_correct_signal = false; // データなしは「正しいシグナルではなかった」扱い
    return {
      factor: r.factor,
      had_correct_signal,
      weight,
      impact_num: r.impact_num,
    };
  });

  // Claude にお願いする文章生成
  const generated = await generateNarrativeWithClaude({
    match,
    prediction,
    player_a,
    player_b,
    winner,
    loser,
    is_correct,
    factor_attribution: factor_attribution_json,
  });

  return {
    is_correct,
    result_summary: generated.result_summary,
    honest_review: generated.honest_review,
    lesson_learned: generated.lesson_learned,
    factor_attribution_json,
  };
}

// -----------------------------------------------------------------
// Claude API 呼び出し (失敗・未設定時はフォールバック)
// -----------------------------------------------------------------

interface NarrativeArgs {
  match: Match;
  prediction: Prediction;
  player_a: Player;
  player_b: Player;
  winner: Player;
  loser: Player;
  is_correct: boolean;
  factor_attribution: FactorAttribution[];
}

interface Narrative {
  result_summary: string;
  honest_review: string;
  lesson_learned: string;
}

const NARRATIVE_SYS = `あなたは将棋棋士の YouTuber 「はじめ先生」の文体ライターです。
将棋勝敗予想 AI 「Shogi Edge」の予想結果を振り返ります。

口調指針:
- フランク (敬語は使わない / でも丁寧)
- 結論を先に言う
- 言い訳しない。外したら外したと正直に書く
- テンプレ調禁止 (「予想通りでした」「残念な結果でした」みたいな当たり障りない文は出さない)
- ジョーク・絵文字は禁止
- 「データを見ると」「分析すると」のような AI 臭い導入禁止
- 数値は具体的に (62-38, 95差, .812 など)

出力は必ず JSON 形式:
{
  "result_summary": "対局の結果と簡単な流れ (1〜2文・各文 60字以内)",
  "honest_review": "予想が当たった/外れた理由を正直に (1〜3文)",
  "lesson_learned": "次の予想に活かす教訓 (1〜2文)"
}`;

async function generateNarrativeWithClaude(args: NarrativeArgs): Promise<Narrative> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = buildFallback(args);
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const userPrompt = buildUserPrompt(args);
    const resp = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: NARRATIVE_SYS,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();
    const parsed = tryParseJSON(text);
    if (parsed && parsed.result_summary && parsed.honest_review && parsed.lesson_learned) {
      return {
        result_summary: String(parsed.result_summary).trim(),
        honest_review: String(parsed.honest_review).trim(),
        lesson_learned: String(parsed.lesson_learned).trim(),
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function buildUserPrompt(args: NarrativeArgs): string {
  const { prediction, player_a, player_b, winner, is_correct, factor_attribution, match } = args;
  const winA = prediction.win_prob_a;
  const winB = prediction.win_prob_b;
  const correctFactors = factor_attribution.filter((f) => f.had_correct_signal && f.weight > 0);
  const wrongFactors = factor_attribution.filter(
    (f) => !f.had_correct_signal && f.weight > 0 && Math.abs(f.impact_num) > 0.01,
  );
  return [
    `棋戦: ${match.tournament}`,
    `${player_a.name} vs ${player_b.name}`,
    `予想: ${prediction.predicted_winner_id === player_a.id ? player_a.name : player_b.name}優勢 (${player_a.name} ${(winA * 100).toFixed(0)}% - ${player_b.name} ${(winB * 100).toFixed(0)}% / 信頼度★${prediction.confidence})`,
    `実際: ${winner.name}勝ち`,
    `結果: ${is_correct ? "的中" : "外れ"}`,
    "",
    "予想時に正しい方を指していた要素:",
    correctFactors.length === 0
      ? "  (なし)"
      : correctFactors.map((f) => `  - ${f.factor} (重み ${(f.weight * 100).toFixed(0)}%)`).join("\n"),
    "",
    "予想時に間違った方を指していた要素:",
    wrongFactors.length === 0
      ? "  (なし)"
      : wrongFactors.map((f) => `  - ${f.factor} (重み ${(f.weight * 100).toFixed(0)}%, impact ${f.impact_num.toFixed(2)})`).join("\n"),
    "",
    `→ 上記の事実に基づき、はじめ先生口調で振り返って。${is_correct ? "的中の理由を正直に。" : "外した理由を正直に。言い訳禁止。"} JSON で。`,
  ].join("\n");
}

function tryParseJSON(text: string): { result_summary?: string; honest_review?: string; lesson_learned?: string } | null {
  try {
    // ```json ... ``` フェンスを剥がす
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // JSON でなければ最初の { から最後の } を取り出して再挑戦
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

// -----------------------------------------------------------------
// フォールバック (API キー未設定 or 失敗時)
// 推測ではなく事実だけを並べる
// -----------------------------------------------------------------
function buildFallback(args: NarrativeArgs): Narrative {
  const { prediction, player_a, player_b, winner, loser, is_correct, factor_attribution } = args;
  const winA = prediction.win_prob_a;
  const winB = prediction.win_prob_b;
  const predictedWinnerName =
    prediction.predicted_winner_id === player_a.id ? player_a.name : player_b.name;

  const correct = factor_attribution.filter((f) => f.had_correct_signal && f.weight > 0);
  const wrong = factor_attribution.filter(
    (f) => !f.had_correct_signal && f.weight > 0 && Math.abs(f.impact_num) > 0.01,
  );

  const result_summary = `${winner.name}が${loser.name}に勝利。${(winA * 100).toFixed(0)}-${(winB * 100).toFixed(0)}の事前予想は${is_correct ? "的中" : "外れ"}。`;

  const honest_review = is_correct
    ? `${predictedWinnerName}優勢の予想通り。${correct.length > 0 ? correct.map((f) => f.factor).join("・") + " が正しい方向を指していた。" : ""}信頼度★${prediction.confidence}は妥当。`
    : `${predictedWinnerName}優勢で出したが ${winner.name} が勝った。${wrong.length > 0 ? wrong.map((f) => f.factor).join("・") + " が逆を指していた。" : ""}データの読み違い。`;

  const lesson_learned = is_correct
    ? correct.length >= 3
      ? "複数要素が一致したケースは強い。信頼度の出し方は機能している。"
      : "片寄った要素で当たったので、再現性はまだ未確認。サンプルを増やす。"
    : wrong.length === 0
      ? "全要素データ不足での外し。サンプル不足のときは信頼度を下げるべき。"
      : `${wrong[0].factor}の重みを見直すか、対戦相手別の細分データが必要。`;

  return { result_summary, honest_review, lesson_learned };
}
