import { bulkImportPlayers, bulkImportHeadToHead } from "@/app/admin/actions";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default function AdminImport() {
  return (
    <>
      <h1 className="font-serif text-3xl font-bold mb-2">CSV 一括取込</h1>
      <p className="mb-8 text-xs text-sumi-300">
        Excel / スプレッドシートからカンマ区切りで貼り付け。1行に書ききれない値はダブルクォート (
        <code className="text-shu-300">&quot;</code>) で囲んでください。
      </p>

      <section className="mb-12 rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-2 font-serif text-lg">棋士の一括取込</h2>
        <p className="mb-4 text-xs text-sumi-400">
          列順: <code className="text-washi-200">name, kanji_name, rank, region, master, rating, notes</code>
          <br />
          <span className="text-[10px] text-sumi-500">
            (region は <code>tokyo</code> または <code>kansai</code> / 空欄可。rating 省略時は 1500)
          </span>
        </p>
        <details className="mb-3 text-xs">
          <summary className="cursor-pointer text-sumi-300 hover:text-washi-100">サンプル</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-sumi-950 p-3 text-[11px] text-washi-200">
{`# コメント行はOK
藤井聡太,藤井聡太,竜王・名人,kansai,杉本昌隆,2000,シード
永瀬拓矢,永瀬拓矢,九段,tokyo,安恵照剛,1880,
渡辺明,渡辺明,九段,tokyo,所司和晴,1840,`}
          </pre>
        </details>
        <ImportForm action={bulkImportPlayers} label="棋士を取込" />
      </section>

      <section className="rounded-2xl border border-washi-100/8 bg-sumi-900/40 p-6">
        <h2 className="mb-2 font-serif text-lg">直接対戦の一括取込</h2>
        <p className="mb-4 text-xs text-sumi-400">
          列順:{" "}
          <code className="text-washi-200">
            match_date, player_a_name, player_b_name, tournament, opening, winner_name, kifu_url
          </code>
          <br />
          <span className="text-[10px] text-sumi-500">
            (棋士名は事前に登録されている必要あり / opening は engine が解釈する英字キー)
          </span>
        </p>
        <details className="mb-3 text-xs">
          <summary className="cursor-pointer text-sumi-300 hover:text-washi-100">サンプル</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-sumi-950 p-3 text-[11px] text-washi-200">
{`2024-03-15,藤井聡太,永瀬拓矢,叡王戦,kakugawari,藤井聡太,
2024-02-10,藤井聡太,豊島将之,王将戦,ai_kakari,藤井聡太,
2024-01-20,永瀬拓矢,渡辺明,王座戦,yagura,永瀬拓矢,`}
          </pre>
        </details>
        <details className="mb-3 text-xs">
          <summary className="cursor-pointer text-sumi-300 hover:text-washi-100">戦型キー一覧</summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-sumi-300">
            <li>ai_kakari — 相掛かり</li>
            <li>kakugawari — 角換わり</li>
            <li>yokofudori — 横歩取り</li>
            <li>yagura — 矢倉</li>
            <li>gangi — 雁木</li>
            <li>shikenbisha — 四間飛車</li>
            <li>sankenbisha — 三間飛車</li>
            <li>nakabisha — 中飛車</li>
            <li>mukaibisha — 向かい飛車</li>
            <li>gokigen — ゴキゲン中飛車</li>
            <li>fujii_system — 藤井システム</li>
            <li>other — その他</li>
          </ul>
        </details>
        <ImportForm action={bulkImportHeadToHead} label="直接対戦を取込" />
      </section>
    </>
  );
}
