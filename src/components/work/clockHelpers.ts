import { SCHEDULE_MATCH_MS, type WorkOp } from "@/lib/work/clock";
import type { PayMode } from "@/lib/work/shift";
import type { WorkClientData } from "@/lib/work/view";
import { newId } from "./useWorkClock";

/**
 * Picar entrada: copia as condições atuais (valor/hora, percentagem, meta) e,
 * se houver um turno planeado para agora, a saída prevista dele.
 */
export function buildClockIn(data: WorkClientData, startedAt: number): WorkOp {
  const next = data.nextShift;
  const matches = next != null && startedAt >= next.startsAt - SCHEDULE_MATCH_MS && startedAt < next.endsAt;
  return {
    type: "clock_in",
    shift: {
      id: newId(),
      startedAt,
      plannedEndAt: matches ? next.endsAt : null,
      scheduledShiftId: matches ? next.id : null,
      motorcycleId: data.motorcycle?.id ?? null,
      payMode: data.settings.payMode,
      hourlyRateCents: data.settings.hourlyRateCents,
      allocationBp: data.settings.allocationBp,
      target: data.settings.target,
      breaks: [],
    },
  };
}

/** Em salário fixo, o valor do tempo é um equivalente, não pagamento extra. */
export function earningsLabel(payMode: PayMode): string {
  return payMode === "monthly" ? "Equivalente de salário" : "Ganhos estimados";
}

export function earningsLabelLower(payMode: PayMode): string {
  return payMode === "monthly" ? "de equivalente de salário" : "de ganhos estimados";
}
