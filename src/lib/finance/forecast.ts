import { AVG_DAYS_PER_MONTH, DAY_MS, type SavingsRate } from "./history";
import type { Cents } from "./money";

export type ForecastSource = "reached" | "history" | "minimum_pay" | "monthly_goal" | "none";

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
  /** Parte do ordenado mínimo destinada à mota, por mês (0 = não definido). */
  minimumPayCents?: Cents;
  monthlyGoalCents: Cents;
  now: Date;
}

/**
 * Data prevista para atingir a meta. Usa o maior entre o ritmo real de
 * poupança (com histórico suficiente e positivo) e a parte do ordenado mínimo
 * para a mota: o ordenado garante um ritmo, mesmo com o histórico ainda curto
 * ou com pagamentos por registar. Sem nenhum dos dois, usa a meta mensal; sem
 * meta, não há previsão.
 */
export function computeForecast({ missingCents, rate, minimumPayCents = 0, monthlyGoalCents, now }: ForecastInput): Forecast {
  if (missingCents <= 0) {
    return { source: "reached", centsPerMonth: rate?.centsPerMonth ?? null, months: 0, date: now };
  }

  let source: ForecastSource;
  let centsPerMonth: number;
  const real = rate && rate.centsPerMonth >= 1 ? rate.centsPerMonth : 0;
  if (real > 0 || minimumPayCents > 0) {
    source = minimumPayCents > real ? "minimum_pay" : "history";
    centsPerMonth = Math.max(real, minimumPayCents);
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
