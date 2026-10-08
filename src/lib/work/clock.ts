import { MINUTE_MS, type GoalTarget, type PayMode, type ShiftBreak } from "./shift";

/**
 * Operações do relógio de ponto. São aplicadas primeiro no telemóvel (estado
 * local, funciona offline) e enviadas depois ao servidor por ordem. Todas têm
 * ids gerados no cliente, por isso repetir uma operação não a duplica.
 */

export interface ClockShift {
  id: string;
  startedAt: number;
  plannedEndAt: number | null;
  scheduledShiftId: string | null;
  motorcycleId: string | null;
  payMode: PayMode;
  hourlyRateCents: number;
  allocationBp: number;
  target: GoalTarget;
  breaks: ShiftBreak[];
}

export interface CompletedClockShift extends ClockShift {
  endedAt: number;
}

export type WorkOp =
  | { type: "clock_in"; shift: ClockShift }
  | { type: "break_start"; shiftId: string; breakId: string; at: number; paid: boolean }
  | { type: "break_end"; shiftId: string; breakId: string; at: number }
  | { type: "clock_out"; shiftId: string; at: number }
  | { type: "set_start"; shiftId: string; at: number }
  | { type: "set_planned_end"; shiftId: string; at: number | null };

export interface ClockState {
  active: ClockShift | null;
  /** Último turno terminado neste dispositivo (para o resumo/recompensa). */
  lastCompleted: CompletedClockShift | null;
}

export type ApplyResult = { ok: true; state: ClockState } | { ok: false; error: string };

const fail = (error: string): ApplyResult => ({ ok: false, error });

/** Aplica uma operação ao estado local, com as mesmas regras do servidor. */
export function applyWorkOp(state: ClockState, op: WorkOp): ApplyResult {
  const active = state.active;

  if (op.type === "clock_in") {
    if (active) return active.id === op.shift.id ? { ok: true, state } : fail("Já tens um turno a decorrer.");
    return { ok: true, state: { ...state, active: { ...op.shift, breaks: [] } } };
  }

  if (!active || active.id !== op.shiftId) {
    // Repetição de uma saída já aplicada: não faz nada.
    if (op.type === "clock_out" && state.lastCompleted?.id === op.shiftId) return { ok: true, state };
    return fail("Este turno já não está a decorrer.");
  }

  const openBreak = active.breaks.find((b) => b.endedAt == null) ?? null;

  switch (op.type) {
    case "break_start": {
      if (active.breaks.some((b) => b.id === op.breakId)) return { ok: true, state };
      if (openBreak) return fail("Já estás em pausa.");
      const lastEnd = Math.max(active.startedAt, ...active.breaks.map((b) => b.endedAt ?? 0));
      const at = Math.max(op.at, lastEnd);
      const breaks = [...active.breaks, { id: op.breakId, startedAt: at, endedAt: null, paid: op.paid }];
      return { ok: true, state: { ...state, active: { ...active, breaks } } };
    }
    case "break_end": {
      const target = active.breaks.find((b) => b.id === op.breakId);
      if (!target) return fail("Pausa não encontrada.");
      if (target.endedAt != null) return { ok: true, state };
      const breaks = active.breaks.map((b) => (b.id === op.breakId ? { ...b, endedAt: Math.max(op.at, b.startedAt) } : b));
      return { ok: true, state: { ...state, active: { ...active, breaks } } };
    }
    case "clock_out": {
      const lastBreakStart = Math.max(active.startedAt, ...active.breaks.map((b) => b.startedAt));
      const endedAt = Math.max(op.at, lastBreakStart, active.startedAt + 1000);
      const breaks = active.breaks.map((b) => (b.endedAt == null ? { ...b, endedAt } : b));
      return { ok: true, state: { active: null, lastCompleted: { ...active, breaks, endedAt } } };
    }
    case "set_start": {
      const firstBreak = Math.min(...active.breaks.map((b) => b.startedAt));
      if (op.at > firstBreak) return fail("A entrada tem de ser antes da primeira pausa.");
      if (active.plannedEndAt != null && op.at >= active.plannedEndAt) return fail("A entrada tem de ser antes da saída prevista.");
      return { ok: true, state: { ...state, active: { ...active, startedAt: op.at } } };
    }
    case "set_planned_end": {
      if (op.at != null && op.at <= active.startedAt) return fail("A saída prevista tem de ser depois da entrada.");
      return { ok: true, state: { ...state, active: { ...active, plannedEndAt: op.at } } };
    }
  }
}

// ---------------------------------------------------------------------------
// Validação das operações recebidas pelo servidor (dados não confiáveis)
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Instantes aceites: de 2020 a 2100 (protege contra lixo).
const MIN_TIME = Date.UTC(2020, 0, 1);
const MAX_TIME = Date.UTC(2100, 0, 1);

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const isTime = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= MIN_TIME && v <= MAX_TIME;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseWorkOp(input: unknown): WorkOp | null {
  if (!isRecord(input)) return null;
  switch (input.type) {
    case "clock_in": {
      const s = input.shift;
      if (!isRecord(s)) return null;
      if (!isUuid(s.id) || !isTime(s.startedAt)) return null;
      if (!(s.plannedEndAt === null || isTime(s.plannedEndAt))) return null;
      if (!(s.scheduledShiftId === null || isUuid(s.scheduledShiftId))) return null;
      if (!(s.motorcycleId === null || isUuid(s.motorcycleId))) return null;
      if (s.payMode !== "hourly" && s.payMode !== "monthly") return null;
      if (s.target !== "minimum" && s.target !== "full") return null;
      if (!isInt(s.hourlyRateCents, 0, 100000) || !isInt(s.allocationBp, 0, 10000)) return null;
      return {
        type: "clock_in",
        shift: {
          id: s.id,
          startedAt: s.startedAt,
          plannedEndAt: s.plannedEndAt,
          scheduledShiftId: s.scheduledShiftId,
          motorcycleId: s.motorcycleId,
          payMode: s.payMode,
          hourlyRateCents: s.hourlyRateCents,
          allocationBp: s.allocationBp,
          target: s.target,
          breaks: [],
        },
      };
    }
    case "break_start":
      if (!isUuid(input.shiftId) || !isUuid(input.breakId) || !isTime(input.at) || typeof input.paid !== "boolean") return null;
      return { type: "break_start", shiftId: input.shiftId, breakId: input.breakId, at: input.at, paid: input.paid };
    case "break_end":
      if (!isUuid(input.shiftId) || !isUuid(input.breakId) || !isTime(input.at)) return null;
      return { type: "break_end", shiftId: input.shiftId, breakId: input.breakId, at: input.at };
    case "clock_out":
    case "set_start":
      if (!isUuid(input.shiftId) || !isTime(input.at)) return null;
      return { type: input.type, shiftId: input.shiftId, at: input.at };
    case "set_planned_end":
      if (!isUuid(input.shiftId) || !(input.at === null || isTime(input.at))) return null;
      return { type: "set_planned_end", shiftId: input.shiftId, at: input.at };
    default:
      return null;
  }
}

/** Instantes do cliente não podem estar no futuro do servidor (relógio adiantado). */
export function clampToNow(at: number, serverNow: number): number {
  return Math.min(at, serverNow);
}

/** Tolerância para considerar um turno planeado "o de agora" ao picar entrada. */
export const SCHEDULE_MATCH_MS = 60 * MINUTE_MS;
