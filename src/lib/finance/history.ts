import { countedCents, type AccountKind } from "./accounts";
import type { Cents } from "./money";

/** Um registo de balance_snapshots, já convertido para cêntimos. */
export interface BalanceSnapshot {
  accountId: string;
  recordedAt: Date;
  balanceCents: Cents;
  kind: AccountKind;
  countPct: number;
  safetyMarginPct: number;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Duração média de um mês (365,25 / 12 dias). */
export const AVG_DAYS_PER_MONTH = 30.4375;

function byTime(a: BalanceSnapshot, b: BalanceSnapshot) {
  return a.recordedAt.getTime() - b.recordedAt.getTime();
}

/** Agrupa por conta, com os registos de cada conta por ordem cronológica. */
export function groupByAccount(snapshots: BalanceSnapshot[]): Map<string, BalanceSnapshot[]> {
  const groups = new Map<string, BalanceSnapshot[]>();
  for (const snapshot of [...snapshots].sort(byTime)) {
    const list = groups.get(snapshot.accountId);
    if (list) list.push(snapshot);
    else groups.set(snapshot.accountId, [snapshot]);
  }
  return groups;
}

function lastAtOrBefore(list: BalanceSnapshot[], at: Date): BalanceSnapshot | undefined {
  let found: BalanceSnapshot | undefined;
  for (const snapshot of list) {
    if (snapshot.recordedAt.getTime() <= at.getTime()) found = snapshot;
    else break;
  }
  return found;
}

/** Total que contava para a mota num dado momento, segundo o histórico. */
export function totalAt(snapshots: BalanceSnapshot[], at: Date): Cents {
  let total = 0;
  for (const list of groupByAccount(snapshots).values()) {
    const snapshot = lastAtOrBefore(list, at);
    if (snapshot) total += countedCents(snapshot);
  }
  return total;
}

export interface SeriesPoint {
  at: Date;
  totalCents: Cents;
}

/** Evolução do total juntado: um ponto por cada registo (para o gráfico). */
export function totalSeries(snapshots: BalanceSnapshot[]): SeriesPoint[] {
  const current = new Map<string, Cents>();
  let total = 0;
  const points: SeriesPoint[] = [];

  for (const snapshot of [...snapshots].sort(byTime)) {
    const value = countedCents(snapshot);
    total += value - (current.get(snapshot.accountId) ?? 0);
    current.set(snapshot.accountId, value);

    const last = points[points.length - 1];
    if (last && last.at.getTime() === snapshot.recordedAt.getTime()) last.totalCents = total;
    else points.push({ at: snapshot.recordedAt, totalCents: total });
  }

  return points;
}

export interface SavingsRate {
  centsPerMonth: number;
  /** Dias de histórico usados no cálculo. */
  days: number;
  since: Date;
}

export interface SavingsRateOptions {
  /** Janela de análise (por omissão, os últimos 6 meses). */
  windowMonths?: number;
  /** Mínimo de dias de histórico para o ritmo ser considerado fiável. */
  minDays?: number;
}

/**
 * Ritmo médio de poupança (€/mês) a partir do histórico de saldos.
 *
 * Cada conta é medida a partir do primeiro saldo registado (ou do início da
 * janela, se já existia antes). Assim, introduzir os saldos iniciais ou
 * acrescentar uma conta que já tinha dinheiro não conta como poupança.
 *
 * Devolve null se não houver histórico suficiente.
 */
export function computeSavingsRate(
  snapshots: BalanceSnapshot[],
  now: Date,
  { windowMonths = 6, minDays = 30 }: SavingsRateOptions = {},
): SavingsRate | null {
  const windowStart = new Date(now.getTime() - windowMonths * AVG_DAYS_PER_MONTH * DAY_MS);
  let deltaCents = 0;
  let earliest: Date | null = null;

  for (const list of groupByAccount(snapshots).values()) {
    const end = lastAtOrBefore(list, now);
    if (!end) continue;

    const beforeWindow = lastAtOrBefore(list, windowStart);
    const baseline = beforeWindow ?? list[0];
    const start = beforeWindow ? windowStart : baseline.recordedAt;

    deltaCents += countedCents(end) - countedCents(baseline);
    if (!earliest || start.getTime() < earliest.getTime()) earliest = start;
  }

  if (!earliest) return null;
  const days = (now.getTime() - earliest.getTime()) / DAY_MS;
  if (days < minDays) return null;

  return {
    centsPerMonth: deltaCents / (days / AVG_DAYS_PER_MONTH),
    days,
    since: earliest,
  };
}
