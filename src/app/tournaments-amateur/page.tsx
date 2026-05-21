import { createServerSupabase } from "@/lib/supabase/client";
import { PageShell } from "@/components/PageShell";
import { formatDateJa } from "@/lib/utils";
import type { TournamentAmateur } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AmateurTournaments() {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("tournaments_amateur")
    .select("*")
    .gte("match_date", new Date().toISOString().slice(0, 10))
    .order("match_date", { ascending: true });
  const tournaments = (data ?? []) as unknown as TournamentAmateur[];

  return (
    <PageShell>
      <header className="mb-8">
        <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-shu-400">amateur</p>
        <h1 className="font-serif text-3xl font-bold">アマ大会日程</h1>
        <p className="mt-2 text-xs text-sumi-300">
          将棋大会ナビ等の公開情報を元に集約。Live 中継対象は <span className="text-shu-400">LIVE</span> ラベル付き。
        </p>
      </header>

      {tournaments.length === 0 ? (
        <p className="text-sm text-sumi-400">登録された大会はまだありません。</p>
      ) : (
        <ul className="divide-y divide-washi-100/5 rounded-2xl border border-washi-100/8 bg-sumi-900/60">
          {tournaments.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-name text-lg">{t.name}</div>
                <div className="mt-0.5 text-xs text-sumi-400">
                  <span className="font-num tabular-nums">{formatDateJa(t.match_date)}</span>
                  {t.location ? ` · ${t.location}` : ""}
                  {t.prize_money ? ` · ${t.prize_money}` : ""}
                </div>
              </div>
              {t.has_live ? (
                <span className="rounded bg-shu-500/15 px-2 py-0.5 text-[10px] text-shu-300">LIVE</span>
              ) : (
                <span className="text-[10px] text-sumi-500">中継未確認</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-[11px] text-sumi-500">
        将棋大会ナビへの連絡が取れた段階で自動連携を有効化予定。それまでは管理画面から手動登録します。
      </p>
    </PageShell>
  );
}
