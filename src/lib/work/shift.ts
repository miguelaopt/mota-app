import type { Cents } from "@/lib/finance/money";

/**
 * Cálculos de um turno a partir de instantes (nunca de um contador que vai
 * somando segundos). O timer do ecrã só redesenha; a fonte de verdade é
 * `agora − entrada − pausas não pagas`.
 */

export type PayMode = "hourly" | "monthly";
export type GoalTarget = "minimum" | "full";

export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
/** 100% em pontos base. */
export const FULL_BP = 10000;

export interface ShiftBreak {
  id: string;
  startedAt: number;
  /** null = pausa a decorrer. */
  endedAt: number | null;
  paid: boolean;
}

export interface ShiftTiming {
  startedAt: number;
  /** null = turno a decorrer. */
  endedAt: number | null;
  plannedEndAt: number | null;
  breaks: ShiftBreak[];
}

/** Condições copiadas para o turno no momento da entrada. */
export interface ShiftTerms {
  hourlyRateCents: Cents;
  /** 0–10000 (pontos base) dos ganhos estimados destinados à mota. */
  allocationBp: number;
}

export interface ShiftTimes {
  /** Da entrada à saída (ou a agora). */
  totalMs: number;
  /** Todas as pausas (pagas e não pagas). */
  breakMs: number;
  unpaidBreakMs: number;
  /** Tempo pago = total − pausas não pagas. */
  paidMs: number;
  /** Pausa a decorrer, se houver. */
  openBreak: ShiftBreak | null;
  /** Até à saída prevista (0 se já passou; null sem saída prevista). */
  remainingMs: number | null;
  /** Quanto a saída prevista já foi ultrapassada (0 se ainda não). */
  overtimeMs: number;
}

type Interval = [number, number];

/** Soma de intervalos sem contar duas vezes as partes sobrepostas. */
function unionLength(intervals: Interval[]): number {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let current: Interval | null = null;
  for (const [a, b] of sorted) {
    if (current && a <= current[1]) {
      current[1] = Math.max(current[1], b);
    } else {
      if (current) total += current[1] - current[0];
      current = [a, b];
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}

export function computeShiftTimes(shift: ShiftTiming, now: number): ShiftTimes {
  const end = Math.max(shift.startedAt, shift.endedAt ?? now);
  const clip = (b: ShiftBreak): Interval => [
    Math.max(shift.startedAt, b.startedAt),
    Math.min(end, b.endedAt ?? end),
  ];

  const totalMs = end - shift.startedAt;
  const breakMs = unionLength(shift.breaks.map(clip));
  const unpaidBreakMs = unionLength(shift.breaks.filter((b) => !b.paid).map(clip));
  const openBreak = shift.endedAt == null ? (shift.breaks.find((b) => b.endedAt == null) ?? null) : null;

  let remainingMs: number | null = null;
  let overtimeMs = 0;
  if (shift.plannedEndAt != null) {
    remainingMs = Math.max(0, shift.plannedEndAt - end);
    overtimeMs = Math.max(0, end - shift.plannedEndAt);
  }

  return { totalMs, breakMs, unpaidBreakMs, paidMs: Math.max(0, totalMs - unpaidBreakMs), openBreak, remainingMs, overtimeMs };
}

/** Ganhos estimados: calculados sobre a duração total e arredondados só no fim. */
export function estimateEarningsCents(paidMs: number, hourlyRateCents: Cents): Cents {
  if (paidMs <= 0 || hourlyRateCents <= 0) return 0;
  return Math.round((paidMs * hourlyRateCents) / HOUR_MS);
}

/** Parte dos ganhos estimados planeada para a mota. */
export function plannedCents(earnedCents: Cents, allocationBp: number): Cents {
  if (earnedCents <= 0 || allocationBp <= 0) return 0;
  return Math.round((earnedCents * Math.min(allocationBp, FULL_BP)) / FULL_BP);
}

export interface ShiftEstimate extends ShiftTimes {
  earnedCents: Cents;
  plannedCents: Cents;
}

export function estimateShift(shift: ShiftTiming & ShiftTerms, now: number): ShiftEstimate {
  const times = computeShiftTimes(shift, now);
  const earned = estimateEarningsCents(times.paidMs, shift.hourlyRateCents);
  return { ...times, earnedCents: earned, plannedCents: plannedCents(earned, shift.allocationBp) };
}

/**
 * Estimativa se o turno terminar na saída prevista (uma pausa aberta conta
 * como terminada agora). null sem saída prevista.
 */
export function estimateAtPlannedEnd(shift: ShiftTiming & ShiftTerms, now: number): ShiftEstimate | null {
  if (shift.plannedEndAt == null || shift.endedAt != null) return null;
  const end = Math.max(shift.plannedEndAt, now);
  const breaks = shift.breaks.map((b) => (b.endedAt == null ? { ...b, endedAt: Math.min(now, end) } : b));
  return estimateShift({ ...shift, breaks, endedAt: end }, end);
}

/** Estimativa de um turno planeado (início/fim previstos e pausas não pagas previstas). */
export function estimatePlannedShift(
  plan: { startsAt: number; endsAt: number; unpaidBreakMinutes: number },
  terms: ShiftTerms,
): { paidMs: number; earnedCents: Cents; plannedCents: Cents } {
  const paidMs = Math.max(0, plan.endsAt - plan.startsAt - plan.unpaidBreakMinutes * MINUTE_MS);
  const earned = estimateEarningsCents(paidMs, terms.hourlyRateCents);
  return { paidMs, earnedCents: earned, plannedCents: plannedCents(earned, terms.allocationBp) };
}

/** Equivalente horário de um salário fixo: salário ÷ horas previstas. */
export function monthlyToHourlyCents(monthlyCents: Cents, monthlyHours: number): Cents {
  if (monthlyCents <= 0 || !(monthlyHours > 0)) return 0;
  return Math.round(monthlyCents / monthlyHours);
}

/** Percentagem (0–100, com decimais) → pontos base. */
export function pctToBp(pct: number): number {
  return Math.round(Math.min(100, Math.max(0, pct)) * 100);
}

export function bpToPct(bp: number): number {
  return bp / 100;
}

/** Turno a rever ao abrir o resumo: muito longo ou muito para lá da saída prevista. */
export const UNUSUAL_PAID_MS = 12 * HOUR_MS;
export const UNUSUAL_OVERTIME_MS = 3 * HOUR_MS;

export function isUnusualShift(times: Pick<ShiftTimes, "paidMs" | "overtimeMs" | "totalMs">): boolean {
  return times.totalMs > UNUSUAL_PAID_MS || times.paidMs > UNUSUAL_PAID_MS || times.overtimeMs > UNUSUAL_OVERTIME_MS;
}

export interface BreakValidationInput {
  startedAt: number;
  endedAt: number | null;
  breaks: Array<Pick<ShiftBreak, "startedAt" | "endedAt">>;
}

/**
 * Valida o horário de um turno e das pausas: devolve uma mensagem de erro em
 * português ou null. Pausas não se sobrepõem e ficam dentro do turno.
 */
export function validateShiftTimes({ startedAt, endedAt, breaks }: BreakValidationInput): string | null {
  if (endedAt != null && endedAt <= startedAt) return "A saída tem de ser depois da entrada.";
  if (endedAt != null && endedAt - startedAt > 24 * HOUR_MS) return "Um turno não pode durar mais de 24 horas.";
  const sorted = [...breaks].sort((a, b) => a.startedAt - b.startedAt);
  let previousEnd = -Infinity;
  for (const b of sorted) {
    const bEnd = b.endedAt ?? Infinity;
    if (b.startedAt < startedAt) return "Há uma pausa antes da entrada.";
    if (endedAt != null && bEnd > endedAt) return "Há uma pausa depois da saída.";
    if (bEnd < b.startedAt) return "Uma pausa termina antes de começar.";
    if (b.startedAt < previousEnd) return "Há pausas sobrepostas.";
    previousEnd = bEnd;
  }
  return null;
}
