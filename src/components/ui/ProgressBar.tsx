import { cn } from "@/lib/cn";

/** Riscas da projeção (planeado, ainda não é dinheiro real). */
export const PROJECTION_STRIPES = "repeating-linear-gradient(135deg, rgb(42 245 179 / 0.8) 0 3px, rgb(42 245 179 / 0.16) 3px 6px)";

export function ProgressBar({
  pct,
  label,
  size = "md",
  tone = "accent",
  projectedPct,
  markPct,
  className,
}: {
  pct: number;
  label: string;
  size?: "sm" | "md" | "lg";
  tone?: "accent" | "success" | "muted";
  /** Extensão às riscas até esta percentagem (projeção, não dinheiro real). */
  projectedPct?: number;
  /** Marca vertical (ex.: o mínimo para começar a andar). */
  markPct?: number;
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
        "relative w-full rounded-full bg-track",
        size === "sm" && "h-1.5",
        size === "md" && "h-2.5",
        size === "lg" && "h-3",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
          tone === "accent" && "bg-accent shadow-[0_0_14px_rgb(42_245_179/0.45)]",
          tone === "success" && "bg-success shadow-[0_0_14px_rgb(42_245_179/0.45)]",
          tone === "muted" && "bg-muted",
        )}
        style={{ width: `${clamped}%` }}
      />
      {projected > clamped && (
        <div
          className="absolute inset-y-0 rounded-r-full"
          style={{ left: `${clamped}%`, width: `${projected - clamped}%`, background: PROJECTION_STRIPES }}
          aria-hidden
        />
      )}
      {markPct != null && markPct > 0 && markPct < 100 && (
        <span
          className="absolute -top-1 h-[calc(100%+0.5rem)] w-0.5 -translate-x-1/2 rounded-full bg-fg/70"
          style={{ left: `${markPct}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}
