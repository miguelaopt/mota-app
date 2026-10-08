import { cn } from "@/lib/cn";

export function ProgressBar({
  pct,
  label,
  size = "md",
  tone = "accent",
  projectedPct,
  className,
}: {
  pct: number;
  label: string;
  size?: "sm" | "md" | "lg";
  tone?: "accent" | "success" | "muted";
  /** Extensão tracejada até esta percentagem (projeção, não dinheiro real). */
  projectedPct?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const projected = projectedPct == null ? clamped : Math.max(clamped, Math.min(100, projectedPct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(clamped)}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-track",
        size === "sm" && "h-1.5",
        size === "md" && "h-2.5",
        size === "lg" && "h-4",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
          tone === "accent" && "bg-accent",
          tone === "success" && "bg-success",
          tone === "muted" && "bg-muted",
        )}
        style={{ width: `${clamped}%` }}
      />
      {projected > clamped && (
        <div
          className="absolute inset-y-0 opacity-60"
          style={{
            left: `${clamped}%`,
            width: `${projected - clamped}%`,
            background: "repeating-linear-gradient(90deg, var(--accent) 0 6px, transparent 6px 10px)",
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
