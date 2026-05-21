import type { HeadToHead, Player } from "@/types/db";
import { formatDateJa } from "@/lib/utils";

const OPENING_LABEL: Record<string, string> = {
  ai_kakari: "相掛かり",
  kakugawari: "角換わり",
  yokofudori: "横歩取り",
  yagura: "矢倉",
  gangi: "雁木",
  shikenbisha: "四間飛車",
  sankenbisha: "三間飛車",
  nakabisha: "中飛車",
  mukaibisha: "向かい飛車",
  gokigen: "ゴキゲン中飛車",
  fujii_system: "藤井システム",
  other: "その他",
};

interface Props {
  player_a: Player;
  player_b: Player;
  rows: HeadToHead[];
}

export function HeadToHeadList({ player_a, player_b, rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
        <h3 className="mb-2 font-serif text-lg">直接対戦履歴</h3>
        <p className="text-xs text-sumi-400">対戦記録なし</p>
      </div>
    );
  }
  const aWins = rows.filter((h) => h.winner_id === player_a.id).length;
  const bWins = rows.filter((h) => h.winner_id === player_b.id).length;
  return (
    <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg">直接対戦履歴</h3>
        <div className="font-num text-xs text-sumi-300 tabular-nums">
          通算 {player_a.name} <span className="text-shu-400 font-medium">{aWins}</span> -{" "}
          <span className="text-ai-300 font-medium">{bWins}</span> {player_b.name}
        </div>
      </div>
      <ul className="divide-y divide-washi-100/5 text-xs">
        {rows.map((r) => {
          const winnerName =
            r.winner_id === player_a.id
              ? player_a.name
              : r.winner_id === player_b.id
                ? player_b.name
                : "—";
          return (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="font-num tabular-nums text-sumi-400">
                  {formatDateJa(r.match_date)}
                </span>
                {r.tournament ? <span className="text-sumi-200">{r.tournament}</span> : null}
                {r.opening ? (
                  <span className="rounded bg-sumi-800 px-1.5 py-0.5 text-[10px] text-sumi-300">
                    {OPENING_LABEL[r.opening] ?? r.opening}
                  </span>
                ) : null}
              </div>
              <span
                className={
                  r.winner_id === player_a.id
                    ? "text-shu-400 font-medium"
                    : r.winner_id === player_b.id
                      ? "text-ai-300 font-medium"
                      : "text-sumi-500"
                }
              >
                {winnerName} 勝ち
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
