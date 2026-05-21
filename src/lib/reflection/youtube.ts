import type { WeeklyReflection, MatchReflection, Match, Player } from "@/types/db";

// =============================================================
// YouTube 振り返り動画 台本生成 (仕様書 §9.6)
// 構成: イントロ → 的中率発表 → ハイライト3つ → 学んだこと → 来週の見どころ
// =============================================================

export interface ReflectionHighlight {
  reflection: MatchReflection;
  match: Match;
  players: Player[];
}

export function buildWeeklyReflectionScript(args: {
  weekly: WeeklyReflection;
  highlights: ReflectionHighlight[]; // 最大3つ
}): string {
  const { weekly, highlights } = args;
  const acc = (weekly.accuracy * 100).toFixed(1);
  const star5 = weekly.confidence_breakdown_json["5_star"];

  const lines: string[] = [];
  lines.push(`【今週の予想振り返り】${weekly.period_start} 〜 ${weekly.period_end}`);
  lines.push("");
  lines.push("■イントロ");
  lines.push(
    `「Shogi Edge」が出した先週の予想、何勝何敗だったか答え合わせ。データだけで本当に当たるのか。`,
  );
  lines.push("");
  lines.push("■今週の的中率");
  lines.push(`総予想 ${weekly.total} 件・的中 ${weekly.correct}・的中率 ${acc}%。`);
  if (star5 && star5.total > 0) {
    lines.push(
      `信頼度★5は ${star5.correct}/${star5.total} (${(star5.accuracy * 100).toFixed(0)}%)。`,
    );
  }
  lines.push("");
  lines.push("■ハイライト対局");
  if (highlights.length === 0) {
    lines.push("(この週はピックアップする対局がなかった)");
  } else {
    highlights.forEach((h, i) => {
      const winner = h.players.find((p) => p.id === h.reflection.actual_winner_id);
      const playersStr = h.players.map((p) => p.name).join(" vs ");
      lines.push(
        `${i + 1}. ${h.match.tournament} ${playersStr} → ${winner?.name ?? "?"}勝ち (${h.reflection.is_correct ? "的中" : "外し"})`,
      );
      lines.push(`   ${h.reflection.honest_review}`);
    });
  }
  lines.push("");
  lines.push("■今週学んだこと");
  if (weekly.patterns_found_json.length === 0) {
    lines.push(`サンプル数 ${weekly.total} で大きな傾向は出なかった。`);
  } else {
    for (const p of weekly.patterns_found_json) {
      lines.push(`・${p}`);
    }
  }
  lines.push("");
  lines.push("■改善案");
  if (weekly.improvement_suggestions_json.length === 0) {
    lines.push("特になし。サンプルを増やしてから判断する。");
  } else {
    for (const s of weekly.improvement_suggestions_json) {
      lines.push(`・${s}`);
    }
  }
  lines.push("");
  lines.push("■来週の見どころ");
  lines.push(weekly.next_week_focus);
  lines.push("");
  lines.push("──");
  lines.push(
    "本予想は「Shogi Edge」がデータから算出した参考値です。結果を保証するものではありません。",
  );
  return lines.join("\n");
}
