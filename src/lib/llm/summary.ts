import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// 仕様書 §1.4 一言サマリー生成
// はじめ先生口調 (フランク・短くテンポ良く・結論先出し) で 1〜2文に整形する

const PROMPT_SYS = `あなたは将棋棋士の YouTuber 「はじめ先生」の文体ライターです。
口調の指針:
- 結論を先に言う
- フランク (敬語は使わない / でも丁寧)
- 1〜2文・各文 50字以内・テンポ良く
- 数値は具体的に (62-38, 95差, .812 など)
- 「〜と思う」「〜かも」など弱い結びは避ける
- ジョーク・絵文字は禁止
- 「データを見ると」「分析すると」など、AI 臭い導入禁止

出力は本文のみ (JSON や箇条書きにしない)。`;

interface SummaryInput {
  player_a_name: string;
  player_b_name: string;
  win_prob_a: number;
  win_prob_b: number;
  reasoning_seed: string; // engine.ts の summary_seed
  confidence: number; // 1〜5
}

export async function generateSummary(input: SummaryInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // API キー未設定時はテンプレ的なフォールバック (推測ではなく事実だけ並べる)
    return buildFallbackSummary(input);
  }

  const client = new Anthropic({ apiKey });
  const userPrompt = [
    `${input.player_a_name} vs ${input.player_b_name}`,
    "",
    input.reasoning_seed,
    "",
    `→ この対局について、はじめ先生口調で 1〜2 文に。${(Math.max(input.win_prob_a, input.win_prob_b) * 100).toFixed(0)}-${(Math.min(input.win_prob_a, input.win_prob_b) * 100).toFixed(0)} の数値は必ず文中に入れる。`,
  ].join("\n");

  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: [
      {
        type: "text",
        text: PROMPT_SYS,
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
  return text || buildFallbackSummary(input);
}

function buildFallbackSummary(input: SummaryInput): string {
  const lead = input.win_prob_a >= input.win_prob_b ? input.player_a_name : input.player_b_name;
  const lp = Math.max(input.win_prob_a, input.win_prob_b);
  const trail = Math.min(input.win_prob_a, input.win_prob_b);
  return `${lead}優勢。${(lp * 100).toFixed(0)}-${(trail * 100).toFixed(0)}で勝ち筋が見える。`;
}

// YouTube 台本フォーマット (クリップボードコピー用)
export function buildYouTubeScript(args: {
  tournament: string;
  date: string;
  a: string;
  b: string;
  win_prob_a: number;
  win_prob_b: number;
  confidence: number;
  reasoning_top3: string[];
  one_liner: string;
}): string {
  return [
    `【勝敗予想】${args.tournament} ${args.date}`,
    `${args.a} vs ${args.b}`,
    "",
    "■結論",
    args.one_liner,
    `(${args.a} ${(args.win_prob_a * 100).toFixed(0)}% — ${args.b} ${(args.win_prob_b * 100).toFixed(0)}% / 信頼度★${args.confidence})`,
    "",
    "■根拠 (データから)",
    ...args.reasoning_top3.map((r, i) => `${i + 1}. ${r}`),
    "",
    "■見どころ",
    `両者の戦型選択と中盤の主導権争い。${(args.win_prob_a * 100).toFixed(0)}-${(args.win_prob_b * 100).toFixed(0)} の差を、戦型一つでひっくり返せるかが焦点。`,
    "",
    "──",
    "本予想は「Shogi Edge」がデータから算出した参考値です。結果を保証するものではありません。",
  ].join("\n");
}

// サムネ用フック生成 (5パターン)
export function buildThumbnailHooks(args: {
  a: string;
  b: string;
  win_prob_a: number;
  win_prob_b: number;
}): string[] {
  const leader = args.win_prob_a >= args.win_prob_b ? args.a : args.b;
  const trailer = args.win_prob_a >= args.win_prob_b ? args.b : args.a;
  const lp = Math.round(Math.max(args.win_prob_a, args.win_prob_b) * 100);
  const tp = 100 - lp;
  return [
    `${args.a} vs ${args.b} 勝つのはどっち？`,
    `${leader}優勢 ${lp}対${tp}の根拠`,
    `データで読む${args.a}と${args.b}`,
    `${trailer}に勝ち筋はあるか`,
    `${lp}対${tp} — 7要素で予想する一番勝負`,
  ];
}
