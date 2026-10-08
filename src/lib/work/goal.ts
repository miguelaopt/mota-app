import { AVG_DAYS_PER_MONTH, DAY_MS } from "@/lib/finance/history";
import type { Cents } from "@/lib/finance/money";
import { FULL_BP, MINUTE_MS } from "./shift";

/**
 * Quanto trabalho falta para a meta, a partir do dinheiro que já conta
 * (saldo real) e da parte do valor/hora destinada à mota. Dividir só pelo
 * valor/hora exageraria o progresso se parte do salário tiver outro destino.
 */

export type HoursToGoal =
  | { status: "reached" }
  /** Valor/hora ou percentagem a zero: não há como calcular. */
  | { status: "no_contribution" }
  | { status: "ok"; hours: number; contributionCentsPerHour: number };

export function contributionPerHour(hourlyRateCents: Cents, allocationBp: number): number {
  if (hourlyRateCents <= 0 || allocationBp <= 0) return 0;
  return (hourlyRateCents * Math.min(allocationBp, FULL_BP)) / FULL_BP;
}

export function hoursToGoal(missingCents: Cents, hourlyRateCents: Cents, allocationBp: number): HoursToGoal {
  if (missingCents <= 0) return { status: "reached" };
  const perHour = contributionPerHour(hourlyRateCents, allocationBp);
  if (perHour <= 0) return { status: "no_contribution" };
  return { status: "ok", hours: missingCents / perHour, contributionCentsPerHour: perHour };
}

/** Turnos equivalentes (arredondados para cima) para uma duração paga de referência. */
export function equivalentShifts(hours: number, referencePaidMinutes: number | null): number | null {
  if (!referencePaidMinutes || referencePaidMinutes <= 0 || hours <= 0) return null;
  // Arredondar antes do ceil evita 250,0000001 → 251 por causa da vírgula flutuante.
  return Math.ceil(Math.round((hours / (referencePaidMinutes / 60)) * 1e6) / 1e6);
}

export interface ReferenceDuration {
  minutes: number;
  source: "settings" | "average";
}

/** Duração paga de referência: a definida, ou a média dos turnos concluídos. */
export function referenceDuration(settingMinutes: number | null, completedPaidMs: number[]): ReferenceDuration | null {
  if (settingMinutes && settingMinutes > 0) return { minutes: settingMinutes, source: "settings" };
  const valid = completedPaidMs.filter((ms) => ms > 0);
  if (valid.length === 0) return null;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  const minutes = Math.round(avg / MINUTE_MS);
  return minutes > 0 ? { minutes, source: "average" } : null;
}

export interface WorkForecast {
  /** Contribuição planeada por semana com a frequência habitual. */
  centsPerWeek: number;
  weeks: number;
  months: number;
  date: Date;
}

/**
 * Data prevista só com o trabalho: frequência semanal × duração de referência
 * × contribuição por hora. Não soma a meta mensal (que pode já incluir o
 * salário). Sem frequência ou sem contribuição não há data.
 */
export function workForecast({
  missingCents,
  hourlyRateCents,
  allocationBp,
  referencePaidMinutes,
  shiftsPerWeek,
  now,
}: {
  missingCents: Cents;
  hourlyRateCents: Cents;
  allocationBp: number;
  referencePaidMinutes: number | null;
  shiftsPerWeek: number | null;
  now: Date;
}): WorkForecast | null {
  if (missingCents <= 0 || !shiftsPerWeek || shiftsPerWeek <= 0 || !referencePaidMinutes) return null;
  const perHour = contributionPerHour(hourlyRateCents, allocationBp);
  const centsPerWeek = perHour * (referencePaidMinutes / 60) * shiftsPerWeek;
  if (centsPerWeek <= 0) return null;
  const weeks = missingCents / centsPerWeek;
  const days = Math.ceil(weeks * 7);
  return { centsPerWeek, weeks, months: days / AVG_DAYS_PER_MONTH, date: new Date(now.getTime() + days * DAY_MS) };
}

export interface Milestone {
  key: string;
  label: string;
  cents: Cents;
}

const PCT_MILESTONES = [25, 30, 40, 50, 75];

/** Marcos: percentagens do setup completo, o mínimo para andar e o setup completo. */
export function milestones(minimumCents: Cents, fullCents: Cents): Milestone[] {
  const list: Milestone[] = [];
  if (fullCents > 0) {
    for (const pct of PCT_MILESTONES) {
      list.push({ key: `pct-${pct}`, label: `${pct}% do setup completo`, cents: Math.ceil((fullCents * pct) / 100) });
    }
  }
  if (minimumCents > 0) list.push({ key: "minimum", label: "mínimo para andar", cents: minimumCents });
  if (fullCents > 0) list.push({ key: "full", label: "setup completo", cents: fullCents });
  return list.sort((a, b) => a.cents - b.cents);
}

/** Próximo marco acima do dinheiro que já conta (real). */
export function nextMilestone(savedCents: Cents, minimumCents: Cents, fullCents: Cents): Milestone | null {
  return milestones(minimumCents, fullCents).find((m) => m.cents > savedCents) ?? null;
}
