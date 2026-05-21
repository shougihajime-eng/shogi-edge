"use client";

import { useState } from "react";

interface Props {
  script: string;
  hooks: string[];
}

export function YouTubeTools({ script, hooks }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied("err");
    }
  };

  return (
    <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <h3 className="mb-3 font-serif text-lg">YouTube 制作補助</h3>

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-sumi-400">台本</span>
          <button
            type="button"
            onClick={() => copy(script, "script")}
            className="rounded-md border border-washi-100/10 px-2.5 py-1 text-xs hover:bg-sumi-800"
          >
            {copied === "script" ? "コピー済み" : "全文コピー"}
          </button>
        </div>
        <pre className="max-h-48 overflow-y-auto rounded-lg bg-sumi-950 p-3 text-[11px] leading-relaxed whitespace-pre-wrap font-num text-washi-200">
{script}
        </pre>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-sumi-400">サムネ用フック (5案)</span>
        </div>
        <ul className="space-y-1.5">
          {hooks.map((h, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-md border border-washi-100/5 bg-sumi-950 px-3 py-2 text-xs"
            >
              <span className="font-serif">{h}</span>
              <button
                type="button"
                onClick={() => copy(h, `hook-${i}`)}
                className="rounded border border-washi-100/10 px-2 py-0.5 text-[10px] hover:bg-sumi-800"
              >
                {copied === `hook-${i}` ? "コピー済" : "コピー"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
