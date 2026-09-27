import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl bg-card p-4", className)} {...props} />;
}

/** Lista agrupada ao estilo iOS (linhas separadas por uma linha fina). */
export function ListGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("divide-y divide-sep overflow-hidden rounded-2xl bg-card", className)} {...props} />;
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-6", className)}>
      {(title || action) && (
        <div className="mb-2 flex min-h-6 items-end justify-between gap-2 px-1">
          {title && <h2 className="text-[0.8rem] font-semibold uppercase tracking-wide text-muted">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Par rótulo/valor em linha. */
export function StatRow({ label, value, hint, strong }: { label: ReactNode; value: ReactNode; hint?: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={cn("text-muted", strong && "font-medium text-fg")}>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={cn("shrink-0 tabular-nums", strong && "font-semibold")}>{value}</span>
    </div>
  );
}
