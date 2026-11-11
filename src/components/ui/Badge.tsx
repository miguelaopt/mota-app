import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border border-glass-border bg-white/[0.05] text-muted",
  accent: "border border-accent-line bg-accent-soft text-accent",
  success: "border border-accent-line bg-success-soft text-success",
  warning: "border border-warning/25 bg-warning-soft text-warning",
  danger: "border border-danger/25 bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Notice({ tone = "warning", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl px-4 py-3 text-sm", tones[tone], className)}>{children}</div>;
}
