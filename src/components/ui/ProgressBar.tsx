import { cn } from "@/lib/cn";

export function ProgressBar({
  pct,
  label,
  size = "md",
  tone = "accent",
  className,
}: {
  pct: number;
  label: string;
  size?: "sm" | "md" | "lg";
  tone?: "accent" | "success" | "muted";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(clamped)}
      className={cn(
        "w-full overflow-hidden rounded-full bg-track",
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
    </div>
  );
}
