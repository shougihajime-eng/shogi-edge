"use client";

import { useState, useTransition } from "react";
import type { ImportResult } from "@/app/admin/actions";

interface Props {
  action: (formData: FormData) => Promise<ImportResult>;
  label: string;
}

export function ImportForm({ action, label }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await action(fd);
          setResult(r);
        });
      }}
      className="space-y-3"
    >
      <textarea
        name="csv"
        required
        rows={8}
        placeholder="ここに CSV を貼り付け..."
        className="w-full rounded-lg border border-washi-100/10 bg-sumi-950 p-3 text-xs font-num text-washi-200 placeholder-sumi-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-shu-500 px-4 py-2 text-sm font-medium text-washi-100 hover:bg-shu-600 disabled:opacity-50"
      >
        {pending ? "取込中..." : label}
      </button>

      {result && (
        <div className="rounded-lg border border-washi-100/8 bg-sumi-950 p-3 text-xs">
          <p className="font-medium">
            <span className="text-kincha-400">{result.added}</span> 行成功 /{" "}
            <span className="text-shu-400">{result.errors.length}</span> 行エラー
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px]">
              {result.errors.map((e, i) => (
                <li key={i} className="text-shu-300">
                  行{e.row}: {e.reason} —{" "}
                  <code className="text-sumi-400">{e.line}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
