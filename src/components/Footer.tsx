export function Footer() {
  return (
    <footer className="mt-24 border-t border-washi-100/5 py-10">
      <div className="mx-auto max-w-6xl px-6 text-[11px] leading-relaxed text-sumi-400">
        <p className="mb-2">
          <span className="font-serif text-washi-100">Shogi Edge</span> —
          Live 中継対象のプロ棋戦・アマ大会に絞った、データ根拠付き勝敗予想ツール。
        </p>
        <p>
          予想はあくまでデータに基づく確率推定であり、結果を保証するものではありません。
          棋士・選手の正確な情報は
          <a
            href="https://www.shogi.or.jp/"
            target="_blank"
            rel="noreferrer"
            className="ml-1 underline decoration-sumi-600 hover:text-washi-100"
          >
            日本将棋連盟公式
          </a>{" "}
          をご確認ください。
        </p>
      </div>
    </footer>
  );
}
