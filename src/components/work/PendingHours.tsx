"use client";

import { cn } from "@/lib/cn";
import { formatEur, type Cents } from "@/lib/finance/money";
import type { GoalTarget } from "@/lib/work/shift";
import { formatHoursCeil } from "@/lib/work/format";
import { equivalentShifts, hoursToGoal } from "@/lib/work/goal";
import { estimateShift } from "@/lib/work/shift";
import { TARGET_LABEL, type WorkClientData } from "@/lib/work/view";
import { useWorkClock } from "./useWorkClock";

/**
 * Horas e turnos em falta se o dinheiro por confirmar já estivesse nas contas.
 * Desce logo a cada "Turno feito" ou "Picar saída" (antes de chegar ao
 * servidor); o número principal continua a vir do saldo real.
 */
export function PendingHours({
  data,
  targets,
  hourlyRateCents,
  allocationBp,
  referenceMinutes,
}: {
  data: WorkClientData;
  /** Meta principal primeiro. */
  targets: Array<{ target: GoalTarget; missingCents: Cents }>;
  hourlyRateCents: Cents;
  allocationBp: number;
  referenceMinutes: number | null;
}) {
  const clock = useWorkClock({ userId: data.userId, serverActive: data.activeShift, renderedAt: data.renderedAt });
  const local = clock.localCompleted.map((s) => estimateShift({ ...s, holiday: data.settings.holiday }, s.endedAt).plannedCents);
  const pendingCents = data.pendingPlannedCents + local.reduce((sum, c) => sum + c, 0);
  const count = data.pendingShiftCount + local.length;
  if (pendingCents <= 0) return null;

  const rows = targets.map(({ target, missingCents }) => {
    const h = hoursToGoal(missingCents - pendingCents, hourlyRateCents, allocationBp);
    return { target, h, shifts: h.status === "ok" ? equivalentShifts(h.hours, referenceMinutes) : null };
  });
  const [main, ...others] = rows;
  if (main.h.status === "no_contribution") return null;

  return (
    <div className="rounded-[14px] border border-accent-line bg-accent-soft px-3.5 py-3" aria-live="polite">
      <p className="text-xs text-muted tabular-nums">
        Contando com os <span className="font-semibold text-fg">{formatEur(pendingCents)}</span> por confirmar ({count}{" "}
        {count === 1 ? "turno" : "turnos"})
      </p>
      {main.h.status === "reached" ? (
        <p className="display mt-1 text-2xl text-accent">Chegas ao {TARGET_LABEL[main.target]}</p>
      ) : (
        <p className="mt-1 leading-snug">
          <span
            key={Math.round(main.h.status === "ok" ? main.h.hours : 0)}
            className={cn("display text-[1.75rem] text-accent", data.settings.animations && "reward-pop inline-block")}
          >
            ≈ {formatHoursCeil(main.h.status === "ok" ? main.h.hours : 0)} h
          </span>
          {main.shifts != null && <span className="text-sm text-muted tabular-nums"> · ≈ {main.shifts} turnos</span>}
          <span className="text-sm text-muted"> para o {TARGET_LABEL[main.target]}</span>
        </p>
      )}
      {others.map(({ target, h, shifts }) => (
        <p key={target} className="mt-0.5 text-xs text-muted tabular-nums">
          {h.status === "reached"
            ? `Chegas ao ${TARGET_LABEL[target]}`
            : h.status === "ok"
              ? `≈ ${formatHoursCeil(h.hours)} h${shifts != null ? ` · ≈ ${shifts} turnos` : ""} até ao ${TARGET_LABEL[target]}`
              : null}
        </p>
      ))}
    </div>
  );
}
