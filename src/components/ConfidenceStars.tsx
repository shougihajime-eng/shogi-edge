import { cn } from "@/lib/utils";

interface Props {
  value: number; // 1〜5
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceStars({ value, size = "sm", className }: Props) {
  const v = Math.max(1, Math.min(5, value));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        size === "sm" ? "text-[10px]" : "text-sm",
        className,
      )}
      aria-label={`信頼度 ${v} / 5`}
      title={`信頼度 ${v} / 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "leading-none",
            i < v ? "text-kincha-500" : "text-sumi-700",
          )}
        >
          ★
        </span>
      ))}
    </span>
  );
}
