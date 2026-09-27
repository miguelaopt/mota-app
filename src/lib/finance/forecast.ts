import { AVG_DAYS_PER_MONTH, DAY_MS, type SavingsRate } from "./history";
import type { Cents } from "./money";

export type ForecastSource = "reached" | "history" | "monthly_goal" | "none";

export interface Forecast {
  source: ForecastSource;
  /** Ritmo usado no cálculo. */
  centsPerMonth: number | null;
  /** Meses até atingir a meta. */
  months: number | null;
  date: Date | null;
}

export interface ForecastInput {
  missingCents: Cents;
  rate: SavingsRate | null;
  monthlyGoalCents: Cents;
  now: Date;
}

/**
 * Data prevista para atingir a meta: usa o ritmo real de poupança quando há
 * histórico suficiente e positivo; caso contrário, a meta mensal definida nas
 * definições; sem nenhum dos dois, não há previsão.
 */
export function computeForecast({ missingCents, rate, monthlyGoalCents, now }: ForecastInput): Forecast {
  if (missingCents <= 0) {
    return { source: "reached", centsPerMonth: rate?.centsPerMonth ?? null, months: 0, date: now };
  }

  let source: ForecastSource;
  let centsPerMonth: number;
  if (rate && rate.centsPerMonth >= 1) {
    source = "history";
    centsPerMonth = rate.centsPerMonth;
  } else if (monthlyGoalCents > 0) {
    source = "monthly_goal";
    centsPerMonth = monthlyGoalCents;
  } else {
    return { source: "none", centsPerMonth: rate?.centsPerMonth ?? null, months: null, date: null };
  }

  const months = missingCents / centsPerMonth;
  const days = Math.ceil(months * AVG_DAYS_PER_MONTH);
  return { source, centsPerMonth, months, date: new Date(now.getTime() + days * DAY_MS) };
}
