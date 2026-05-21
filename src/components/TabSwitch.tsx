"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  active?: boolean;
}

export function TabSwitch({ tabs }: { tabs: Tab[] }) {
  return (
    <div className="inline-flex rounded-full border border-washi-100/8 bg-sumi-900/60 p-1">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
            t.active
              ? "bg-shu-500 text-washi-100 shadow-lg shadow-shu-500/20"
              : "text-sumi-300 hover:text-washi-100",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

// 「対局カード」セクション (プロ/アマ切替) 用の自動推定タブ
export function ProAmaTabs({ current }: { current: "pro" | "ama" }) {
  return (
    <TabSwitch
      tabs={[
        { href: "/", label: "プロ棋戦", active: current === "pro" },
        { href: "/?tab=ama", label: "アマ棋戦", active: current === "ama" },
      ]}
    />
  );
}
