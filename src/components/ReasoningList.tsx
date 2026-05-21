"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ReasoningEntry } from "@/types/db";

interface Props {
  items: ReasoningEntry[];
}

export function ReasoningList({ items }: Props) {
  const [openAll, setOpenAll] = useState(true);

  const sorted = [...items].sort((a, b) => Math.abs(b.impact_num) - Math.abs(a.impact_num));

  return (
    <div className="rounded-2xl border border-washi-100/8 bg-sumi-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg">予想の根拠 (7要素)</h3>
        <button
          type="button"
          onClick={() => setOpenAll((v) => !v)}
          className="text-[11px] text-sumi-400 hover:text-washi-100"
        >
          {openAll ? "全部閉じる" : "全部開く"}
        </button>
      </div>
      <ul className="divide-y divide-washi-100/5">
        {sorted.map((r) => (
          <ReasonItem key={r.factor} entry={r} initiallyOpen={openAll} />
        ))}
      </ul>
    </div>
  );
}

function ReasonItem({ entry, initiallyOpen }: { entry: ReasoningEntry; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const hasData = entry.impact !== "判断保留";
  const pos = entry.impact_num >= 0;
  return (
    <li className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              !hasData ? "bg-sumi-500" : pos ? "bg-shu-500" : "bg-ai-500",
            )}
          />
          <span className="font-medium">{entry.factor}</span>
        </span>
        <span
          className={cn(
            "font-num font-medium tabular-nums",
            !hasData ? "text-sumi-500" : pos ? "text-shu-400" : "text-ai-300",
          )}
        >
          {entry.impact}
        </span>
      </button>
      {open && (
        <div className="mt-2 pl-4.5 text-[12px] leading-relaxed text-sumi-300">
          {entry.detail}
        </div>
      )}
    </li>
  );
}
