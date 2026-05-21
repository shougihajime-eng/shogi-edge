import type { MatchReflection, WeeklyReflection, MonthlyReflection } from "@/types/db";

// 対局単位の振り返りカード (詳細画面用)
export function MatchReflectionCard({ reflection }: { reflection: MatchReflection }) {
  const correctCount = reflection.factor_attribution_json.filter(
    (f) => f.had_correct_signal,
  ).length;
  const total = reflection.factor_attribution_json.filter((f) => f.weight > 0).length;

  return (
    <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h3 className="font-serif text-lg">対局後の振り返り</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-num tracking-wider ${
              reflection.is_correct
                ? "bg-ai-700/40 text-ai-300"
                : "bg-shu-500/20 text-shu-300"
            }`}
          >
            {reflection.is_correct ? "的中" : "外れ"}
          </span>
        </div>
        <p className="font-num text-[11px] text-sumi-400">
          根拠の答え合わせ {correctCount}/{total}
        </p>
      </div>

      <div className="mb-4 rounded-xl bg-sumi-800/40 px-4 py-3">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-sumi-400">
          結果
        </p>
        <p className="text-sm text-washi-100">{reflection.result_summary}</p>
      </div>

      <div className="mb-4">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-sumi-400">
          正直な振り返り
        </p>
        <p className="text-sm leading-relaxed text-washi-200">
          {reflection.honest_review}
        </p>
      </div>

      <div className="mb-4">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-kincha-500">
          次に活かす
        </p>
        <p className="text-sm leading-relaxed text-washi-200">
          {reflection.lesson_learned}
        </p>
      </div>

      <p className="mt-3 text-[10px] text-sumi-500">
        生成: {new Date(reflection.generated_at).toLocaleString("ja-JP")}
      </p>
    </section>
  );
}

// 7要素の答え合わせ (緑チェック / 赤バツ)
export function ResultAnswerKey({ reflection }: { reflection: MatchReflection }) {
  return (
    <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <h3 className="mb-3 font-serif text-lg">予想根拠の答え合わせ</h3>
      <ul className="divide-y divide-washi-100/5">
        {reflection.factor_attribution_json.map((f, i) => (
          <li key={i} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm text-washi-100">{f.factor}</p>
              <p className="text-[11px] text-sumi-400">
                重み {(f.weight * 100).toFixed(0)}% / impact {f.impact_num.toFixed(2)}
              </p>
            </div>
            {f.weight === 0 ? (
              <span className="rounded-full bg-sumi-700/50 px-2 py-0.5 text-[10px] text-sumi-300">
                データ無し
              </span>
            ) : f.had_correct_signal ? (
              <span className="font-num text-lg text-ai-300">✓</span>
            ) : (
              <span className="font-num text-lg text-shu-400">✗</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// 週次振り返り (大きく表示)
export function WeeklyReflectionCard({ weekly }: { weekly: WeeklyReflection }) {
  const acc = (weekly.accuracy * 100).toFixed(1);
  return (
    <section className="rounded-2xl border border-kincha-500/30 bg-gradient-to-br from-sumi-900/80 to-sumi-800/40 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-kincha-500">
            weekly reflection
          </p>
          <h2 className="font-serif text-2xl">{weekly.week} の振り返り</h2>
          <p className="mt-1 text-[11px] text-sumi-400">
            {weekly.period_start} 〜 {weekly.period_end}
          </p>
        </div>
        <div className="text-right">
          <p className="font-num text-3xl font-bold tabular-nums text-washi-100">{acc}%</p>
          <p className="text-[11px] text-sumi-400">
            {weekly.correct} / {weekly.total} 的中
          </p>
        </div>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-washi-100">{weekly.weekly_summary}</p>

      {weekly.patterns_found_json.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-sumi-400">
            気づいた傾向
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-washi-200">
            {weekly.patterns_found_json.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {weekly.improvement_suggestions_json.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-shu-400">
            改善案
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-washi-200">
            {weekly.improvement_suggestions_json.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-xl bg-ai-700/20 px-4 py-3">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-ai-300">
          来週の見どころ
        </p>
        <p className="text-sm text-washi-100">{weekly.next_week_focus}</p>
      </div>
    </section>
  );
}

// 過去の週次サマリー (コンパクト)
export function WeeklyReflectionSummaryRow({ weekly }: { weekly: WeeklyReflection }) {
  const acc = (weekly.accuracy * 100).toFixed(1);
  return (
    <li className="flex items-center justify-between border-t border-washi-100/5 py-2.5">
      <div>
        <p className="font-num text-sm text-washi-100">{weekly.week}</p>
        <p className="line-clamp-1 text-[11px] text-sumi-400">{weekly.weekly_summary}</p>
      </div>
      <div className="text-right font-num text-sm tabular-nums">
        <p className="text-washi-100">{acc}%</p>
        <p className="text-[10px] text-sumi-400">
          {weekly.correct}/{weekly.total}
        </p>
      </div>
    </li>
  );
}

// 月次振り返り (簡易表示用)
export function MonthlyReflectionCard({ monthly }: { monthly: MonthlyReflection }) {
  return (
    <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg">{monthly.month} (月次)</h3>
        <span className="font-num text-sm tabular-nums text-washi-100">
          {(monthly.accuracy * 100).toFixed(1)}%
          <span className="ml-2 text-[10px] text-sumi-400">
            ({monthly.correct}/{monthly.total})
          </span>
        </span>
      </div>
      {monthly.weight_adjustment_proposals_json.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-kincha-500">
            重み調整提案
          </p>
          <ul className="space-y-1.5 text-xs">
            {monthly.weight_adjustment_proposals_json.map((p, i) => (
              <li key={i} className="rounded bg-sumi-800/40 px-3 py-2">
                <p className="font-num tabular-nums">
                  {p.key}: {p.current.toFixed(2)} → {p.proposed.toFixed(2)}
                </p>
                <p className="text-sumi-300">{p.rationale}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-sumi-500">
            状態: {monthly.approval_status === "approved" ? "承認済み" : monthly.approval_status === "rejected" ? "却下" : "承認待ち"}
          </p>
        </div>
      ) : (
        <p className="text-xs text-sumi-400">重み調整提案なし</p>
      )}
    </section>
  );
}
