import { cn } from "@/lib/utils";

interface Props {
  nameA: string;
  nameB: string;
  probA: number;
  probB: number;
  size?: "sm" | "lg";
}

export function ProbabilityBar({ nameA, nameB, probA, probB, size = "sm" }: Props) {
  const aPct = Math.round(probA * 100);
  const bPct = 100 - aPct;
  const aWins = probA >= probB;
  return (
    <div className={cn("w-full", size === "lg" ? "space-y-3" : "space-y-1.5")}>
      <div
        className={cn(
          "flex justify-between font-num font-medium tabular-nums",
          size === "lg" ? "text-base" : "text-xs",
        )}
      >
        <span className={cn(aWins ? "text-shu-400" : "text-sumi-300")}>
          {nameA} <span className="font-num">{aPct}%</span>
        </span>
        <span className={cn(!aWins ? "text-shu-400" : "text-sumi-300")}>
          <span className="font-num">{bPct}%</span> {nameB}
        </span>
      </div>
      <div
        className={cn(
          "relative flex h-2 w-full overflow-hidden rounded-full bg-sumi-800",
          size === "lg" && "h-3",
        )}
      >
        <div
          className="h-full bg-gradient-to-r from-shu-500/80 to-shu-600/80"
          style={{ width: `${aPct}%` }}
        />
        <div
          className="h-full bg-gradient-to-l from-ai-500/70 to-ai-700/70"
          style={{ width: `${bPct}%` }}
        />
      </div>
    </div>
  );
}
