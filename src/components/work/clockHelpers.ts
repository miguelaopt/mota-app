import type { WorkOp } from "@/lib/work/clock";
import { MINUTE_MS, type PayMode } from "@/lib/work/shift";
import type { CalendarEntry, WorkClientData } from "@/lib/work/view";
import { newId } from "./useWorkClock";

/**
 * "Turno feito": regista o turno do calendário com o horário planeado e as
 * condições atuais (valor/hora, percentagem, meta). O id do turno é o do
 * calendário, por isso só pode ser registado uma vez. A pausa não paga
 * prevista fica a meio do turno.
 */
export function buildComplete(data: WorkClientData, entry: CalendarEntry): WorkOp {
  const unpaidMs = entry.unpaidBreakMinutes * MINUTE_MS;
  const breakStart = entry.startsAt + Math.round((entry.endsAt - entry.startsAt - unpaidMs) / 2 / MINUTE_MS) * MINUTE_MS;
  return {
    type: "complete",
    shift: {
      id: entry.id,
      startedAt: entry.startsAt,
      endedAt: entry.endsAt,
      plannedEndAt: entry.endsAt,
      scheduledShiftId: entry.id,
      motorcycleId: data.motorcycle?.id ?? null,
      payMode: data.settings.payMode,
      hourlyRateCents: data.settings.hourlyRateCents,
      allocationBp: data.settings.allocationBp,
      target: data.settings.target,
      breaks: unpaidMs > 0 ? [{ id: newId(), startedAt: breakStart, endedAt: breakStart + unpaidMs, paid: false }] : [],
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
