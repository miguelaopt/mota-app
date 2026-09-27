import { describe, expect, it } from "vitest";
import { computeForecast } from "./forecast";

const now = new Date("2026-01-01T12:00:00Z");

describe("computeForecast", () => {
  it("usa o ritmo do histórico quando existe", () => {
    const forecast = computeForecast({
      missingCents: 300000,
      rate: { centsPerMonth: 50000, days: 90, since: new Date("2025-10-03T12:00:00Z") },
      monthlyGoalCents: 20000,
      now,
    });
    expect(forecast.source).toBe("history");
    expect(forecast.months).toBe(6);
    // 6 meses médios = 182,6 dias → 183 dias
    expect(forecast.date).toEqual(new Date("2026-07-03T12:00:00Z"));
  });

  it("usa a meta mensal sem histórico suficiente", () => {
    const forecast = computeForecast({ missingCents: 100000, rate: null, monthlyGoalCents: 25000, now });
    expect(forecast.source).toBe("monthly_goal");
    expect(forecast.months).toBe(4);
    expect(forecast.centsPerMonth).toBe(25000);
  });

  it("usa a meta mensal quando o ritmo é negativo ou nulo", () => {
    const forecast = computeForecast({
      missingCents: 100000,
      rate: { centsPerMonth: -3000, days: 60, since: now },
      monthlyGoalCents: 25000,
      now,
    });
    expect(forecast.source).toBe("monthly_goal");
  });

  it("sem ritmo nem meta mensal, não há previsão", () => {
    const forecast = computeForecast({ missingCents: 100000, rate: null, monthlyGoalCents: 0, now });
    expect(forecast).toEqual({ source: "none", centsPerMonth: null, months: null, date: null });
  });

  it("meta atingida", () => {
    const forecast = computeForecast({ missingCents: 0, rate: null, monthlyGoalCents: 0, now });
    expect(forecast.source).toBe("reached");
    expect(forecast.months).toBe(0);
  });
});
