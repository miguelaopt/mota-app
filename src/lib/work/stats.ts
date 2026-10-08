import type { Cents } from "@/lib/finance/money";
import { dayKey } from "@/lib/dates";
import { estimateShift, type ShiftTerms, type ShiftTiming } from "./shift";

export interface StatsShift extends ShiftTiming, ShiftTerms {
  id: string;
  /** Confirmação de poupança a que o turno foi ligado (null = por confirmar). */
  attributionId: string | null;
}

export interface WorkStats {
  completedCount: number;
  completedThisMonth: number;
  paidMs: number;
  earnedCents: Cents;
  plannedCents: Cents;
  /** Turnos concluídos ainda sem confirmação de poupança. */
  pendingShiftIds: string[];
  pendingPlannedCents: Cents;
  /** Poupança realmente confirmada (soma das atribuições). */
  confirmedCents: Cents;
  /** Maior duração paga (estatística neutra). */
  longestPaidMs: number;
}

/**
 * Totais dos turnos concluídos. Planeado e confirmado ficam separados:
 * só a confirmação corresponde a dinheiro registado numa conta.
 */
export function computeWorkStats(shifts: StatsShift[], confirmedAmounts: Cents[], now: Date): WorkStats {
  const month = dayKey(now).slice(0, 7);
  const stats: WorkStats = {
    completedCount: 0,
    completedThisMonth: 0,
    paidMs: 0,
    earnedCents: 0,
    plannedCents: 0,
    pendingShiftIds: [],
    pendingPlannedCents: 0,
    confirmedCents: confirmedAmounts.reduce((a, b) => a + b, 0),
    longestPaidMs: 0,
  };

  for (const shift of shifts) {
    if (shift.endedAt == null) continue;
    const estimate = estimateShift(shift, shift.endedAt);
    stats.completedCount += 1;
    if (dayKey(new Date(shift.startedAt)).slice(0, 7) === month) stats.completedThisMonth += 1;
    stats.paidMs += estimate.paidMs;
    stats.earnedCents += estimate.earnedCents;
    stats.plannedCents += estimate.plannedCents;
    stats.longestPaidMs = Math.max(stats.longestPaidMs, estimate.paidMs);
    if (shift.attributionId == null) {
      stats.pendingShiftIds.push(shift.id);
      stats.pendingPlannedCents += estimate.plannedCents;
    }
  }

  return stats;
}
