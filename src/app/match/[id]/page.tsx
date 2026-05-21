import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { ConfidenceStars } from "@/components/ConfidenceStars";
import { ReasoningList } from "@/components/ReasoningList";
import { PlayerStatsPanel } from "@/components/PlayerStatsPanel";
import { OpeningDistribution } from "@/components/OpeningDistribution";
import { HeadToHeadList } from "@/components/HeadToHeadList";
import { YouTubeTools } from "@/components/YouTubeTools";
import { loadInputForMatch, loadLatestPrediction } from "@/lib/prediction/repository";
import { loadReflectionByMatch } from "@/lib/reflection/repository";
import {
  MatchReflectionCard,
  ResultAnswerKey,
} from "@/components/ReflectionCard";
import { buildYouTubeScript, buildThumbnailHooks } from "@/lib/llm/summary";
import { formatDateJa, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data;
  try {
    data = await loadInputForMatch(id);
  } catch {
    notFound();
  }
  const prediction = await loadLatestPrediction(id);
  const reflection = await loadReflectionByMatch(id);

  const { match, player_a, player_b, stats_a, stats_b, head_to_heads } = data;
  const actualWinner =
    match.status === "finished" && match.result_winner_id
      ? match.result_winner_id === player_a.id
        ? player_a
        : player_b
      : null;

  return (
    <PageShell>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-xs text-sumi-400 hover:text-washi-100"
      >
        ← 戻る
      </Link>

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-shu-400">
          <span>{match.tournament}</span>
          <span className="text-sumi-500">·</span>
          <span className="font-num text-sumi-300">
            {formatDateJa(match.match_date)}
            {match.match_time
              ? ` ${formatTime(`${match.match_date}T${match.match_time}`)}`
              : ""}
          </span>
          {match.is_live ? (
            <span className="ml-1 rounded bg-shu-500/15 px-1.5 py-0.5 text-[10px] text-shu-300">
              LIVE
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-6">
          <PlayerStatsPanel player={player_a} stats={stats_a} side="left" />
          <div className="hidden md:flex flex-col items-center justify-center pt-12">
            <span className="font-serif text-3xl text-sumi-500">対</span>
            {match.sente_id ? (
              <span className="mt-2 text-[10px] text-kincha-500">
                先手 {match.sente_id === player_a.id ? player_a.name : player_b.name}
              </span>
            ) : null}
          </div>
          <PlayerStatsPanel player={player_b} stats={stats_b} side="right" />
        </div>
      </header>

      {prediction ? (
        <section className="mb-8 rounded-3xl border border-washi-100/8 bg-gradient-to-br from-sumi-900/80 to-sumi-950/80 p-8 piece-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl">予想勝率</h2>
            <ConfidenceStars value={prediction.confidence} size="md" />
          </div>
          <ProbabilityBar
            nameA={player_a.name}
            nameB={player_b.name}
            probA={prediction.win_prob_a}
            probB={prediction.win_prob_b}
            size="lg"
          />
          <p className="mt-5 text-base leading-relaxed font-name">{prediction.summary}</p>
          <p className="mt-2 text-[11px] text-sumi-500">
            生成日時 {new Date(prediction.created_at).toLocaleString("ja-JP")}
          </p>
        </section>
      ) : (
        <NoPrediction matchId={match.id} />
      )}

      {/* 終局済みなら結果バナーと振り返り */}
      {actualWinner && (
        <section className="mb-8 rounded-2xl border border-ai-700/40 bg-ai-900/40 p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-ai-300">
                final result
              </p>
              <p className="font-name text-2xl text-washi-100">
                {actualWinner.name} 勝ち
              </p>
            </div>
            {prediction && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-num ${
                  prediction.predicted_winner_id === actualWinner.id
                    ? "bg-ai-700/40 text-ai-300"
                    : "bg-shu-500/20 text-shu-300"
                }`}
              >
                予想:{" "}
                {prediction.predicted_winner_id === actualWinner.id ? "的中" : "外れ"}
              </span>
            )}
          </div>
        </section>
      )}

      {reflection && (
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <MatchReflectionCard reflection={reflection} />
          <ResultAnswerKey reflection={reflection} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {prediction ? <ReasoningList items={prediction.reasoning_json} /> : null}
        <OpeningDistribution
          dist={prediction?.expected_openings ?? null}
        />
        <HeadToHeadList
          player_a={player_a}
          player_b={player_b}
          rows={head_to_heads}
        />
        {prediction ? (
          <YouTubeTools
            script={buildYouTubeScript({
              tournament: match.tournament,
              date: formatDateJa(match.match_date),
              a: player_a.name,
              b: player_b.name,
              win_prob_a: prediction.win_prob_a,
              win_prob_b: prediction.win_prob_b,
              confidence: prediction.confidence,
              reasoning_top3: prediction.reasoning_json
                .filter((r) => r.impact !== "判断保留")
                .sort((a, b) => Math.abs(b.impact_num) - Math.abs(a.impact_num))
                .slice(0, 3)
                .map((r) => `${r.factor}: ${r.detail} (${r.impact})`),
              one_liner: prediction.summary,
            })}
            hooks={buildThumbnailHooks({
              a: player_a.name,
              b: player_b.name,
              win_prob_a: prediction.win_prob_a,
              win_prob_b: prediction.win_prob_b,
            })}
          />
        ) : null}
      </div>

      <LiveLinks match={match} />
    </PageShell>
  );
}

function NoPrediction({ matchId }: { matchId: string }) {
  return (
    <section className="mb-8 rounded-2xl border border-dashed border-washi-100/15 bg-sumi-900/40 p-8 text-center">
      <p className="font-serif text-lg">この対局の予想はまだ生成されていません</p>
      <p className="mt-2 text-xs text-sumi-400">
        管理画面で両棋士のレーティング・直近成績・直接対戦履歴を登録した後、再生成ボタンを押してください。
      </p>
      <Link
        href={`/admin/matches?focus=${matchId}`}
        className="mt-4 inline-block rounded-lg border border-washi-100/10 px-4 py-2 text-xs hover:bg-sumi-800"
      >
        管理画面で予想を生成
      </Link>
    </section>
  );
}

function LiveLinks({
  match,
}: {
  match: { live_url_shogi_or_jp: string | null; live_url_abema: string | null; live_url_premium: string | null };
}) {
  const items = [
    { label: "将棋連盟LIVE中継", url: match.live_url_shogi_or_jp },
    { label: "ABEMA将棋", url: match.live_url_abema },
    { label: "将棋プレミアム", url: match.live_url_premium },
  ].filter((i) => i.url);
  if (items.length === 0) return null;
  return (
    <section className="mt-8 rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <h3 className="mb-3 font-serif text-lg">中継リンク</h3>
      <ul className="flex flex-wrap gap-2 text-xs">
        {items.map((i) => (
          <li key={i.label}>
            <a
              href={i.url!}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-washi-100/10 px-3 py-1.5 hover:bg-sumi-800"
            >
              {i.label} ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
