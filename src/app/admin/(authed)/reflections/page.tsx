import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";
import {
  generateWeeklyNow,
  generateMonthlyNow,
  approveProposal,
  rejectProposal,
  regenerateMatchReflection,
} from "@/app/admin/actions";
import type {
  MatchReflection,
  MonthlyReflection,
  Player,
  WeeklyReflection,
  WeaknessPattern,
  BacktestResult,
} from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ReflectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const current = (tab as "match" | "weekly" | "monthly" | "patterns" | "backtest") ?? "match";

  const sb = createServerSupabase();
  const [
    { data: matchRefs },
    { data: weeklyRefs },
    { data: monthlyRefs },
    { data: patterns },
    { data: backtests },
    { data: players },
  ] = await Promise.all([
    sb.from("match_reflections").select("*").order("generated_at", { ascending: false }).limit(50),
    sb.from("weekly_reflections").select("*").order("period_start", { ascending: false }).limit(20),
    sb.from("monthly_reflections").select("*").order("period_start", { ascending: false }).limit(12),
    sb.from("weakness_patterns").select("*").order("miss_count", { ascending: false }).limit(50),
    sb.from("backtest_results").select("*").order("tested_at", { ascending: false }).limit(20),
    sb.from("players").select("id, name"),
  ]);

  const pmap = new Map(((players ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const tabs = [
    { key: "match", label: "対局単位" },
    { key: "weekly", label: "週次" },
    { key: "monthly", label: "月次提案" },
    { key: "patterns", label: "弱点パターン" },
    { key: "backtest", label: "バックテスト" },
  ] as const;

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">振り返り (自己学習)</h1>
      <p className="mb-6 text-xs text-sumi-300">
        対局結果を確定するたびに自動で対局単位の振り返りが生成されます。週次/月次は手動で生成し、月次は重み調整提案を承認すると即適用されます。
      </p>

      <nav className="mb-6 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reflections?tab=${t.key}`}
            className={
              current === t.key
                ? "rounded-full bg-shu-500 px-3 py-1.5 text-xs font-medium text-washi-100"
                : "rounded-full border border-washi-100/10 px-3 py-1.5 text-xs text-sumi-300 hover:bg-sumi-800"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {current === "match" && (
        <MatchTab refs={(matchRefs as MatchReflection[]) ?? []} pmap={pmap} />
      )}
      {current === "weekly" && (
        <WeeklyTab refs={(weeklyRefs as WeeklyReflection[]) ?? []} />
      )}
      {current === "monthly" && (
        <MonthlyTab refs={(monthlyRefs as MonthlyReflection[]) ?? []} />
      )}
      {current === "patterns" && (
        <PatternsTab rows={(patterns as WeaknessPattern[]) ?? []} />
      )}
      {current === "backtest" && (
        <BacktestTab rows={(backtests as BacktestResult[]) ?? []} />
      )}
    </>
  );
}

function MatchTab({
  refs,
  pmap,
}: {
  refs: MatchReflection[];
  pmap: Map<string, string>;
}) {
  if (refs.length === 0) {
    return (
      <p className="text-sm text-sumi-400">
        対局結果が確定するとここに振り返りが並びます。/admin/results で確定すると自動生成。
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {refs.map((r) => (
        <li key={r.id} className="rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-5">
          <div className="mb-2 flex items-center justify-between">
            <span
              className={
                r.is_correct
                  ? "rounded bg-kincha-500/15 px-2 py-0.5 text-[11px] text-kincha-400"
                  : "rounded bg-shu-500/15 px-2 py-0.5 text-[11px] text-shu-300"
              }
            >
              {r.is_correct ? "○ 的中" : "× 外し"}
            </span>
            <span className="font-num text-[11px] text-sumi-400">
              {new Date(r.generated_at).toLocaleString("ja-JP")}
            </span>
          </div>
          <p className="font-name text-sm text-washi-200">
            予想: {pmap.get(r.predicted_winner_id) ?? "?"} → 実結果: {pmap.get(r.actual_winner_id) ?? "?"}
          </p>
          <p className="mt-3 text-xs text-sumi-300">
            <span className="text-[10px] uppercase tracking-wider text-sumi-500">結果サマリー</span>
            <br />
            {r.result_summary}
          </p>
          <p className="mt-2 text-xs text-washi-200">
            <span className="text-[10px] uppercase tracking-wider text-sumi-500">正直なレビュー</span>
            <br />
            {r.honest_review}
          </p>
          <p className="mt-2 text-xs text-kincha-400">
            <span className="text-[10px] uppercase tracking-wider text-sumi-500">教訓</span>
            <br />
            {r.lesson_learned}
          </p>
          <details className="mt-3 text-[11px]">
            <summary className="cursor-pointer text-sumi-400 hover:text-washi-100">
              要素別 信号の正誤
            </summary>
            <ul className="mt-2 space-y-0.5">
              {r.factor_attribution_json.map((fa) => (
                <li key={fa.factor} className="flex items-center justify-between">
                  <span>{fa.factor}</span>
                  <span
                    className={
                      fa.had_correct_signal ? "text-kincha-400" : "text-shu-400"
                    }
                  >
                    {fa.had_correct_signal ? "正しい信号" : "誤誘導"} (w {fa.weight.toFixed(2)})
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <form action={regenerateMatchReflection} className="mt-3">
            <input type="hidden" name="prediction_id" value={r.prediction_id} />
            <button className="text-[11px] text-sumi-400 hover:text-shu-400">
              振り返りを再生成
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

function WeeklyTab({ refs }: { refs: WeeklyReflection[] }) {
  return (
    <>
      <form action={generateWeeklyNow} className="mb-6 flex items-center gap-3">
        <input
          type="date"
          name="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-shu-500 px-4 py-2 text-sm font-medium hover:bg-shu-600">
          指定日を含む週の振り返りを生成
        </button>
      </form>

      {refs.length === 0 ? (
        <p className="text-sm text-sumi-400">まだ週次振り返りがありません。</p>
      ) : (
        <ul className="space-y-4">
          {refs.map((w) => (
            <li key={w.id} className="rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-num text-sm text-washi-200">{w.week}</span>
                <span className="font-num text-xs text-sumi-400">
                  {w.period_start} 〜 {w.period_end}
                </span>
              </div>
              <p className="font-num text-2xl tabular-nums text-washi-100">
                {(w.accuracy * 100).toFixed(1)}%{" "}
                <span className="text-xs text-sumi-400">({w.correct}/{w.total})</span>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-washi-200">{w.weekly_summary}</p>
              {w.patterns_found_json.length > 0 && (
                <div className="mt-3">
                  <span className="text-[10px] uppercase tracking-wider text-sumi-500">発見パターン</span>
                  <ul className="mt-1 space-y-0.5 text-xs text-sumi-300">
                    {w.patterns_found_json.map((p, i) => (
                      <li key={i}>・ {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {w.improvement_suggestions_json.length > 0 && (
                <div className="mt-3">
                  <span className="text-[10px] uppercase tracking-wider text-sumi-500">改善提案</span>
                  <ul className="mt-1 space-y-0.5 text-xs text-sumi-300">
                    {w.improvement_suggestions_json.map((s, i) => (
                      <li key={i}>・ {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-xs text-kincha-400">
                来週の注目: {w.next_week_focus}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function MonthlyTab({ refs }: { refs: MonthlyReflection[] }) {
  const FACTOR_LABEL: Record<string, string> = {
    rating: "レーティング差",
    recent_1m: "直近1ヶ月",
    head_to_head: "直接対戦",
    opening_match: "戦型相性",
    side: "手番",
    tournament_time: "棋戦・持ち時間",
    streak: "調子",
  };
  return (
    <>
      <form action={generateMonthlyNow} className="mb-6 flex items-center gap-3">
        <input
          type="date"
          name="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-shu-500 px-4 py-2 text-sm font-medium hover:bg-shu-600">
          指定日を含む月の提案を生成
        </button>
      </form>

      {refs.length === 0 ? (
        <p className="text-sm text-sumi-400">月次振り返りがまだありません。</p>
      ) : (
        <ul className="space-y-4">
          {refs.map((m) => (
            <li key={m.id} className="rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-num text-base text-washi-200">{m.month}</span>
                <span
                  className={
                    m.approval_status === "approved"
                      ? "rounded bg-kincha-500/15 px-2 py-0.5 text-[10px] text-kincha-400"
                      : m.approval_status === "rejected"
                        ? "rounded bg-sumi-700 px-2 py-0.5 text-[10px] text-sumi-300"
                        : "rounded bg-shu-500/15 px-2 py-0.5 text-[10px] text-shu-300"
                  }
                >
                  {m.approval_status === "approved"
                    ? "承認済"
                    : m.approval_status === "rejected"
                      ? "却下"
                      : "未承認"}
                </span>
              </div>
              <p className="font-num text-xl tabular-nums text-washi-100">
                {(m.accuracy * 100).toFixed(1)}%{" "}
                <span className="text-xs text-sumi-400">({m.correct}/{m.total})</span>
              </p>

              <div className="mt-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-sumi-400 mb-2">
                  重み調整提案
                </h3>
                <ul className="space-y-1 text-xs">
                  {m.weight_adjustment_proposals_json.map((p) => (
                    <li key={p.key} className="rounded-lg bg-sumi-950 px-3 py-2">
                      <div className="flex items-center justify-between font-num tabular-nums">
                        <span>{FACTOR_LABEL[p.key] ?? p.key}</span>
                        <span>
                          {p.current.toFixed(2)} → <span className="text-kincha-400">{p.proposed.toFixed(2)}</span>
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-sumi-400">{p.rationale}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {m.approval_status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <form action={approveProposal}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="rounded-lg bg-shu-500 px-4 py-2 text-xs font-medium hover:bg-shu-600">
                      承認して適用
                    </button>
                  </form>
                  <form action={rejectProposal}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="rounded-lg border border-washi-100/10 px-4 py-2 text-xs hover:bg-sumi-800">
                      却下
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PatternsTab({ rows }: { rows: WeaknessPattern[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-sumi-400">
        対局結果が確定するに連れて、繰り返し失敗するパターンが自動で蓄積されます。
      </p>
    );
  }
  return (
    <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/40">
      {rows.map((p) => {
        const missRate = p.total_attempts > 0 ? p.miss_count / p.total_attempts : 0;
        return (
          <li key={p.id} className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-num text-sm">{p.pattern_key}</p>
                {p.description ? <p className="mt-0.5 text-[11px] text-sumi-400">{p.description}</p> : null}
              </div>
              <span className="font-num text-xs tabular-nums text-sumi-300">
                外し {p.miss_count}/{p.total_attempts} ({(missRate * 100).toFixed(0)}%)
                {p.confidence_penalty > 0 ? (
                  <span className="ml-2 text-shu-300">★-{p.confidence_penalty}</span>
                ) : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BacktestTab({ rows }: { rows: BacktestResult[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-sumi-400">
        月次提案を生成すると、提案重みで過去の終局済み対局を再計算したバックテストが自動で走ります。
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {rows.map((b) => (
        <li key={b.id} className="rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-num text-xs text-sumi-400">
              {b.period_start} 〜 {b.period_end} / N={b.sample_size}
            </span>
            <span
              className={
                b.delta > 0
                  ? "font-num text-base text-kincha-400"
                  : b.delta < 0
                    ? "font-num text-base text-shu-400"
                    : "font-num text-base text-sumi-300"
              }
            >
              {(b.delta * 100).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sumi-500">現在</p>
              <p className="font-num text-lg">{(b.current_accuracy * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-sumi-500">提案後</p>
              <p className="font-num text-lg text-kincha-400">
                {(b.projected_accuracy * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          {b.note ? <p className="mt-2 text-[11px] text-sumi-500">{b.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}
