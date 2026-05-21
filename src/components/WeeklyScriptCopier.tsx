"use client";

import { useState } from "react";

interface Props {
  initialScript: string;
}

// YouTube 振り返り台本のコピー UI
// サーバ側で生成済みの script を受け取り、ボタンでクリップボードに入れる
export function WeeklyScriptCopier({ initialScript }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(initialScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 失敗時はユーザに気づいてもらえるよう textarea を強制表示
      setOpen(true);
    }
  };

  return (
    <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="mb-0.5 text-[10px] uppercase tracking-[0.3em] text-shu-400">
            youtube
          </p>
          <h3 className="font-serif text-lg">今週の振り返り動画台本</h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-washi-100/15 px-3 py-1.5 text-xs text-washi-200 hover:bg-sumi-800"
          >
            {open ? "閉じる" : "中身を見る"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md bg-shu-500 px-3 py-1.5 text-xs font-medium text-washi-100 hover:bg-shu-600"
          >
            {copied ? "コピー済み" : "台本をコピー"}
          </button>
        </div>
      </div>
      {open && (
        <textarea
          readOnly
          value={initialScript}
          className="h-72 w-full resize-y rounded-md border border-washi-100/8 bg-sumi-950 p-3 font-num text-xs leading-relaxed text-washi-200"
        />
      )}
      {!open && (
        <p className="text-xs text-sumi-400">
          ボタンを押すと、イントロ → 的中率発表 → ハイライト3つ → 学んだこと → 来週の見どころ
          の構成でクリップボードにコピーされます。
        </p>
      )}
    </div>
  );
}
