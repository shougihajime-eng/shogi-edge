import { createServerSupabase } from "@/lib/supabase/client";
import { upsertPlayerStats, upsertPlayerOpening } from "@/app/admin/actions";
import type { Player } from "@/types/db";

export const dynamic = "force-dynamic";

const OPENINGS = [
  ["ai_kakari", "相掛かり"],
  ["kakugawari", "角換わり"],
  ["yokofudori", "横歩取り"],
  ["yagura", "矢倉"],
  ["gangi", "雁木"],
  ["shikenbisha", "四間飛車"],
  ["sankenbisha", "三間飛車"],
  ["nakabisha", "中飛車"],
  ["mukaibisha", "向かい飛車"],
  ["gokigen", "ゴキゲン中飛車"],
  ["fujii_system", "藤井システム"],
  ["other", "その他"],
] as const;

export default async function AdminPlayerStats() {
  const sb = createServerSupabase();
  const { data } = await sb.from("players").select("*").order("name", { ascending: true });
  const players = (data ?? []) as unknown as Player[];

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">成績入力</h1>
      <p className="mb-8 text-xs text-sumi-300">
        各棋士の直近1ヶ月・通算成績・先手後手別の数字を入力。1回入力すると以降は上書き更新になります。
      </p>

      <section className="mb-10 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-4 font-serif text-lg">成績スナップショット入力</h2>
        <form action={upsertPlayerStats} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-sumi-400">棋士</span>
              <select
                name="player_id"
                required
                className="w-full rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
              >
                <option value="">選択...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.rank})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-sumi-400">スナップショット日付</span>
              <input
                name="snapshot_date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <FieldsetRow
            label="直近1ヶ月"
            fields={[
              ["recent_1m_wins", "勝"],
              ["recent_1m_losses", "敗"],
            ]}
          />
          <FieldsetRow
            label="直近3ヶ月"
            fields={[
              ["recent_3m_wins", "勝"],
              ["recent_3m_losses", "敗"],
            ]}
          />
          <FieldsetRow
            label="直近1年"
            fields={[
              ["recent_1y_wins", "勝"],
              ["recent_1y_losses", "敗"],
            ]}
          />
          <FieldsetRow
            label="今期"
            fields={[
              ["season_wins", "勝"],
              ["season_losses", "敗"],
            ]}
          />
          <FieldsetRow
            label="通算"
            fields={[
              ["total_wins", "勝"],
              ["total_losses", "敗"],
            ]}
          />
          <FieldsetRow
            label="先手"
            fields={[
              ["sente_wins", "勝"],
              ["sente_losses", "敗"],
            ]}
          />
          <FieldsetRow
            label="後手"
            fields={[
              ["gote_wins", "勝"],
              ["gote_losses", "敗"],
            ]}
          />
          <FieldsetRow
            label="連勝/連敗"
            fields={[["current_streak", "正=連勝, 負=連敗"]]}
          />
          <FieldsetRow
            label="千日手/持将棋"
            fields={[
              ["sennichite_count", "千日手"],
              ["jishogi_count", "持将棋"],
            ]}
          />

          <button
            type="submit"
            className="w-full rounded-lg bg-shu-500 px-4 py-2 text-sm font-medium hover:bg-shu-600"
          >
            保存
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-4 font-serif text-lg">戦型別成績の追加</h2>
        <form action={upsertPlayerOpening} className="grid gap-3 md:grid-cols-3">
          <select
            name="player_id"
            required
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">棋士...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="opening"
            required
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">戦型...</option>
            {OPENINGS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="side"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          >
            <option value="">手番(両方合算)</option>
            <option value="sente">先手</option>
            <option value="gote">後手</option>
          </select>
          <input
            name="wins"
            type="number"
            min="0"
            defaultValue="0"
            placeholder="勝"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm font-num"
          />
          <input
            name="losses"
            type="number"
            min="0"
            defaultValue="0"
            placeholder="敗"
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm font-num"
          />
          <button
            type="submit"
            className="rounded-lg bg-shu-500 px-4 py-2 text-sm font-medium hover:bg-shu-600"
          >
            戦型追加
          </button>
        </form>
      </section>
    </>
  );
}

function FieldsetRow({
  label,
  fields,
}: {
  label: string;
  fields: [string, string][];
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-sumi-300">{label}</span>
      <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0,1fr))` }}>
        {fields.map(([name, placeholder]) => (
          <input
            key={name}
            name={name}
            type="number"
            defaultValue="0"
            placeholder={placeholder}
            className="rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-1.5 text-xs font-num"
          />
        ))}
      </div>
    </div>
  );
}
