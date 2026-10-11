import type { Cents } from "@/lib/finance/money";
import type { ClockShift } from "./clock";
import type { GoalTarget, PayMode } from "./shift";

/** Um dia de trabalho no calendário. */
export interface CalendarEntry {
  id: string;
  startsAt: number;
  endsAt: number;
  unpaidBreakMinutes: number;
  status: "planned" | "done";
  /** Turno registado com "Turno feito" (id) e o que ficou planeado para a mota. */
  shiftId: string | null;
  doneCents: Cents | null;
}

/** Dados que o servidor passa aos componentes do modo Trabalho (serializáveis). */
export interface WorkClientData {
  userId: string;
  /** Hora do servidor em que a página foi gerada. */
  renderedAt: number;
  settings: {
    jobName: string;
    payMode: PayMode;
    hourlyRateCents: Cents;
    allocationBp: number;
    target: GoalTarget;
    paidBreaks: boolean;
    haptics: boolean;
    animations: boolean;
  };
  activeShift: ClockShift | null;
  /** Calendário: do mês anterior até três meses à frente. */
  calendar: CalendarEntry[];
  /** Duração por omissão de um turno novo no calendário (minutos). */
  defaultShiftMinutes: number;
  /** Hora de entrada do último turno do calendário ("18:30"), para sugerir. */
  lastStartTime: string | null;
  nextShift: { id: string; startsAt: number; endsAt: number; unpaidBreakMinutes: number } | null;
  motorcycle: { id: string; model: string; photoUrl: string | null } | null;
  goal: {
    /** Dinheiro real que já conta para a mota. */
    savedCents: Cents;
    minimumCents: Cents;
    fullCents: Cents;
  };
  /** Planeado em turnos concluídos e ainda não confirmado. */
  pendingPlannedCents: Cents;
  /** Turnos concluídos associados à mota atual. */
  completedForGoal: number;
  referenceMinutes: number | null;
}

export const TARGET_LABEL: Record<GoalTarget, string> = {
  minimum: "mínimo para andar",
  full: "setup completo",
};

export function targetCents(goal: WorkClientData["goal"], target: GoalTarget): Cents {
  return target === "minimum" ? goal.minimumCents : goal.fullCents;
}
