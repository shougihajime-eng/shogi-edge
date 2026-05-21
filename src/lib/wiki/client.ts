import "server-only";

// =============================================================
// Wikipedia / Wikidata 取得クライアント
// ---------------------------------------------------------------
// 取得方針 (Wikimedia API Etiquette 準拠):
//   * User-Agent 必須 → 連絡先を含める
//   * gzip 受け入れを明示
//   * 429 (Too Many Requests) は Retry-After に従う
//   * 1 リクエスト/秒以下を厳守
// ライセンス:
//   * Wikipedia 本文: CC-BY-SA 3.0 (出典明記必須)
//   * Wikidata: CC0 (パブリックドメイン相当)
// =============================================================

const USER_AGENT =
  "ShogiEdgeBot/0.1 (Shogi Edge prediction app; contact shougi.hajime@gmail.com)";

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WikiFetchOptions {
  /** 429/503 時の最大リトライ回数 */
  maxRetries?: number;
}

async function wikiFetch(
  url: string,
  opts: WikiFetchOptions = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 3;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Encoding": "gzip,deflate",
          "Accept-Language": "ja",
        },
      });
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "5");
        await delay(Math.min(retryAfter, 30) * 1000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Wikimedia fetch failed: ${res.status} ${res.statusText}`);
      }
      return res;
    } catch (e) {
      lastErr = e;
      await delay(2000);
    }
  }
  throw new Error(
    `Wikimedia fetch retries exhausted (${url}): ${String(lastErr)}`,
  );
}

// ---- Wikipedia parsed HTML 取得 ----
export interface ParsedPageResponse {
  title: string;
  pageid: number;
  html: string;
}

export async function fetchWikipediaParsed(
  pageTitle: string,
): Promise<ParsedPageResponse> {
  const url =
    "https://ja.wikipedia.org/w/api.php" +
    `?action=parse&page=${encodeURIComponent(pageTitle)}` +
    "&prop=text&format=json&formatversion=2";
  const res = await wikiFetch(url);
  const json = (await res.json()) as {
    parse?: { title: string; pageid: number; text: string };
    error?: { info?: string };
  };
  if (json.error) {
    throw new Error(`Wikipedia parse error: ${json.error.info ?? "unknown"}`);
  }
  if (!json.parse) {
    throw new Error("Wikipedia parse response missing 'parse' field");
  }
  return {
    title: json.parse.title,
    pageid: json.parse.pageid,
    html: json.parse.text,
  };
}

// ---- Wikidata SPARQL ----
export interface SparqlBindingValue {
  type: string;
  value: string;
  "xml:lang"?: string;
}

export interface SparqlResponse {
  head: { vars: string[] };
  results: { bindings: Record<string, SparqlBindingValue>[] };
}

export async function wikidataSparql(query: string): Promise<SparqlResponse> {
  const url =
    "https://query.wikidata.org/sparql?format=json&query=" +
    encodeURIComponent(query);
  const res = await wikiFetch(url);
  return (await res.json()) as SparqlResponse;
}
