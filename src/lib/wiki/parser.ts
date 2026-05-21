import "server-only";
import * as cheerio from "cheerio";

// =============================================================
// 「将棋棋士一覧」HTML パーサー
// 構造の前提 (Wikipedia ja の同記事 2026-05 時点):
//   * <table> 内に 1 行/棋士の <tr>
//   * 1セル目 (<th> or <td>) = 棋士番号
//   * 名前セル = よみ <br> <a href="/wiki/漢字名">漢字名</a>
//   * 名前セル直後 = 段位 (例: "九段" / "8八段" / "9名誉九段")
//   * 行全体に "【現役】" を含むものは現役 (引退済は引退年が入る)
// 構造が変わったら検出して errors にスタック (壊しても部分成功で運用継続)
// =============================================================

export interface ParsedPlayer {
  player_number: number;
  kanji_name: string;
  current_rank: string;
  wikipedia_path: string;
  birth_region: string | null;
  master: string | null;
  birth_date_iso: string | null; // YYYY-MM-DD
  is_active: boolean; // false = 引退/物故
}

export interface ParseResult {
  players: ParsedPlayer[];
  warnings: string[];
}

const RANK_RE = /(名誉|追贈|物故)?(九|八|七|六|五|四)段/;
const ACTIVE_MARKER = "【現役】";

export function parseShogiPlayerListHtml(html: string): ParseResult {
  const $ = cheerio.load(html);
  // display:none のよみ仮名・ソートキーは、見た目には出ないが .text() で混入する
  // → DOM から事前に除去してから抽出する
  $("[style*='display:none']").remove();
  $("[style*='visibility:hidden']").remove();
  const players: ParsedPlayer[] = [];
  const warnings: string[] = [];

  $("table tr").each((_, tr) => {
    const $tr = $(tr);

    // 見出し行は除外
    if ($tr.hasClass("sticky-table-head")) return;
    if ($tr.find("> th").length > 0 && $tr.find("> td").length === 0) return;

    // セル一式 (th を含む)
    const cells = $tr.find("> th, > td");
    if (cells.length < 6) return;

    // 1セル目に棋士番号 (数値) があるかで「棋士行」と判断
    const firstText = cells.eq(0).text().trim();
    const numMatch = firstText.match(/^\d+/);
    if (!numMatch) return;
    const player_number = parseInt(numMatch[0], 10);
    if (Number.isNaN(player_number)) return;

    // 名前セルを探す: 最初の wikilink で漢字名 (1-6文字漢字+カナ可)
    let nameIdx = -1;
    let kanjiName = "";
    let wikiPath = "";
    cells.each((i, el) => {
      if (nameIdx >= 0) return;
      const $cell = $(el);
      const $a = $cell.find("a").first();
      if ($a.length === 0) return;
      const href = $a.attr("href") ?? "";
      const text = $a.text().trim();
      if (!href.startsWith("/wiki/")) return;
      // 棋士名は 2〜6 文字の漢字主体 (柳澤明日香 等もあり)
      if (!/^[㐀-鿿゠-ヿァ-ヾ々]{2,8}$/.test(text)) return;
      nameIdx = i;
      kanjiName = text;
      wikiPath = href;
    });

    if (nameIdx < 0 || !kanjiName) return;

    // 名前セル直後 = 段位
    const $rankCell = cells.eq(nameIdx + 1);
    if ($rankCell.length === 0) return;
    const rawRankText = $rankCell.text().replace(/\s/g, "");
    const rankMatch = rawRankText.match(RANK_RE);
    if (!rankMatch) {
      // 段位が読めない行 (女流専用列に紛れた等) はスキップ
      return;
    }
    const current_rank = rankMatch[0];

    // 現役判定: 行内に【現役】が含まれていれば active
    // (現役でも 引退年 セルが空文字のことがあるため、明示的マーカーで判定)
    const fullText = $tr.text();
    const is_active = fullText.includes(ACTIVE_MARKER);

    // 出身・師匠は名前セルの 2〜3 つ後 (段位欄が 1〜2 列分のことがあるので幅持たせて検索)
    const between = (start: number, end: number): string => {
      const arr: string[] = [];
      for (let i = start; i <= end && i < cells.length; i++) {
        const t = cells.eq(i).text().replace(/\s+/g, "").trim();
        if (t) arr.push(t);
      }
      return arr.join("|");
    };

    // 出身: 名前+2 or 名前+3 (短い県名/都市名)
    let birth_region: string | null = null;
    for (let i = nameIdx + 2; i <= nameIdx + 4 && i < cells.length; i++) {
      const t = cells.eq(i).text().replace(/\s+/g, "").trim();
      // ソートキーを除去
      const cleaned = t.replace(/^\d+/, "").trim();
      if (cleaned && cleaned.length <= 6 && /^[㐀-鿿・]+$/.test(cleaned)) {
        birth_region = cleaned;
        break;
      }
    }

    // 師匠: 出身の次。<a>有り優先
    let master: string | null = null;
    for (let i = nameIdx + 3; i <= nameIdx + 6 && i < cells.length; i++) {
      const $cell = cells.eq(i);
      const $a = $cell.find("a").first();
      const candidate = $a.length
        ? $a.text().trim()
        : $cell.text().replace(/^\d+/, "").replace(/\s+/g, "").trim();
      if (
        candidate &&
        /^[㐀-鿿]{1,6}/.test(candidate) &&
        candidate !== birth_region &&
        candidate !== kanjiName
      ) {
        master = candidate;
        break;
      }
    }

    // 生年月日: "YYYY年MM月DD日" を探す
    let birth_date_iso: string | null = null;
    for (let i = nameIdx + 4; i <= nameIdx + 8 && i < cells.length; i++) {
      const t = cells.eq(i).text();
      const m = t.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
      if (m) {
        const yyyy = m[1];
        const mm = m[2].padStart(2, "0");
        const dd = m[3].padStart(2, "0");
        birth_date_iso = `${yyyy}-${mm}-${dd}`;
        break;
      }
    }

    players.push({
      player_number,
      kanji_name: kanjiName,
      current_rank,
      wikipedia_path: wikiPath,
      birth_region,
      master,
      birth_date_iso,
      is_active,
    });
  });

  if (players.length === 0) {
    warnings.push(
      "棋士行が 1 件も抽出できませんでした。Wikipedia の表構造が変わった可能性があります。",
    );
  } else if (players.length < 100) {
    warnings.push(
      `抽出数が ${players.length} 件と少なめです(通常 200+)。パーサーが取りこぼしている可能性。`,
    );
  }

  return { players, warnings };
}
