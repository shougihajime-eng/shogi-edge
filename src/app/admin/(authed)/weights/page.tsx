import { createServerSupabase } from "@/lib/supabase/client";
import { saveWeights } from "@/app/admin/actions";
import { DEFAULT_WEIGHTS } from "@/lib/prediction/engine";
import type { WeightHistory, WeightSet } from "@/types/db";

export const dynamic = "force-dynamic";

const LABELS: Record<keyof WeightSet, string> = {
  rating: "レーティング差",
  recent_1m: "直近1ヶ月成績差",
  head_to_head: "直接対戦",
  opening_match: "戦型相性",
  side: "手番(先後)",
  tournament_time: "棋戦・持ち時間",
  streak: "調子(連勝連敗)",
};

export default async function AdminWeights() {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("weight_history")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(50);
  const history = (data ?? []) as unknown as WeightHistory[];
  const current = history[0]?.weights_json ?? DEFAULT_WEIGHTS;
  const keys = Object.keys(LABELS) as (keyof WeightSet)[];

  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">重み調整</h1>
      <p className="mb-8 text-xs text-sumi-300">
        7要素それぞれの寄与の重みを変更できます。合計が 1.00 になるように入力してください。変更履歴は全て保存されます。
      </p>

      <section className="mb-10 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-4 font-serif text-lg">現在値の変更</h2>
        <form action={saveWeights} className="space-y-3">
          {keys.map((k) => (
            <label key={k} className="flex items-center gap-4">
              <span className="w-44 text-sm">{LABELS[k]}</span>
              <input
                name={k}
                type="number"
                min="0"
                max="1"
                step="0.01"
                defaultValue={current[k]}
                className="w-32 rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm font-num"
              />
              <span className="text-xs text-sumi-400">(0〜1)</span>
            </label>
          ))}
          <input
            name="note"
            placeholder="変更メモ (任意)"
            className="w-full rounded-lg border border-washi-100/10 bg-sumi-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-shu-500 px-4 py-2 text-sm font-medium hover:bg-shu-600"
          >
            保存
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-4 font-serif text-lg">変更履歴 (直近50)</h2>
        <ul className="divide-y divide-washi-100/5">
          {history.map((h) => (
            <li key={h.id} className="py-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-num text-sumi-300 tabular-nums">
                  {new Date(h.changed_at).toLocaleString("ja-JP")}
                </span>
                <span className="text-sumi-400">{h.changed_by ?? ""}</span>
              </div>
              <div className="mt-1 font-num text-[10px] text-sumi-400">
                {keys.map((k) => `${k}:${h.weights_json[k]}`).join(" / ")}
              </div>
              {h.note ? <p className="mt-1 text-sumi-300">{h.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
