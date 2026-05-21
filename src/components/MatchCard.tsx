import Link from "next/link";
import { formatDateJa, formatTime } from "@/lib/utils";
import { ConfidenceStars } from "./ConfidenceStars";
import { ProbabilityBar } from "./ProbabilityBar";
import type { Match, Player, Prediction } from "@/types/db";

interface Props {
  match: Match;
  playerA: Player;
  playerB: Player;
  prediction: Prediction | null;
}

export function MatchCard({ match, playerA, playerB, prediction }: Props) {
  return (
    <Link
      href={`/match/${match.id}`}
      className="group block rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5 transition-all hover:-translate-y-0.5 hover:border-shu-500/30 hover:bg-sumi-800/60"
    >
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-sumi-400">
        <span>{match.tournament}</span>
        <span className="font-num">
          {formatDateJa(match.match_date)}
          {match.match_time ? ` ${formatTime(`${match.match_date}T${match.match_time}`)}` : ""}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-name text-xl font-semibold truncate">{playerA.name}</div>
          <div className="text-xs text-sumi-400">
            {playerA.rank} <span className="font-num">R{playerA.rating.toFixed(0)}</span>
            {match.sente_id === playerA.id ? <span className="ml-1.5 text-kincha-500">先</span> : null}
          </div>
        </div>
        <div className="px-3 font-serif text-sumi-500">対</div>
        <div className="min-w-0 flex-1 text-right">
          <div className="font-name text-xl font-semibold truncate">{playerB.name}</div>
          <div className="text-xs text-sumi-400">
            {match.sente_id === playerB.id ? <span className="mr-1.5 text-kincha-500">先</span> : null}
            <span className="font-num">R{playerB.rating.toFixed(0)}</span> {playerB.rank}
          </div>
        </div>
      </div>

      {prediction ? (
        <>
          <ProbabilityBar
            nameA={playerA.name}
            nameB={playerB.name}
            probA={prediction.win_prob_a}
            probB={prediction.win_prob_b}
          />
          <div className="mt-3 flex items-start justify-between gap-3">
            <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-washi-200">
              {prediction.summary}
            </p>
            <ConfidenceStars value={prediction.confidence} />
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-sumi-700 px-3 py-2 text-[11px] text-sumi-400">
          予想未生成 — 棋士データを揃えて管理画面から生成してください
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-[10px] text-sumi-500">
        {match.is_live ? (
          <span className="rounded bg-shu-500/15 px-1.5 py-0.5 text-shu-300">LIVE</span>
        ) : (
          <span className="rounded bg-sumi-800 px-1.5 py-0.5 text-sumi-400">中継未確認</span>
        )}
        <span className="font-num">{labelTC(match.time_control)}</span>
        {match.status === "finished" && match.result_winner_id ? (
          <span className="ml-auto rounded bg-kincha-500/15 px-1.5 py-0.5 text-kincha-400">終局</span>
        ) : null}
      </div>
    </Link>
  );
}

function labelTC(tc: Match["time_control"]) {
  return tc === "long" ? "長時間" : tc === "one_day" ? "一日制" : tc === "fast" ? "早指し" : "超早指し";
}
