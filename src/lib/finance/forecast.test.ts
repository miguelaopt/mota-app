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

  it("o ordenado mínimo é o ritmo quando é maior do que a média real", () => {
    // Caso real: média de 262 €/mês com o histórico curto, ordenado mínimo de 609 €/mês.
    const forecast = computeForecast({
      missingCents: 324000,
      rate: { centsPerMonth: 26200, days: 55, since: new Date("2025-11-07T12:00:00Z") },
      minimumPayCents: 60900,
      monthlyGoalCents: 60000,
      now,
    });
    expect(forecast.source).toBe("minimum_pay");
    expect(forecast.centsPerMonth).toBe(60900);
    expect(forecast.months).toBeCloseTo(324000 / 60900, 9);
    // 5,32 meses ≈ 162 dias
    expect(forecast.date).toEqual(new Date("2026-06-12T12:00:00Z"));
  });

  it("a média real ganha quando já é maior do que o ordenado mínimo", () => {
    const forecast = computeForecast({
      missingCents: 300000,
      rate: { centsPerMonth: 75000, days: 120, since: now },
      minimumPayCents: 60900,
      monthlyGoalCents: 0,
      now,
    });
    expect(forecast.source).toBe("history");
    expect(forecast.centsPerMonth).toBe(75000);
  });

  it("sem histórico, o ordenado mínimo vem antes da meta mensal", () => {
    const forecast = computeForecast({ missingCents: 121800, rate: null, minimumPayCents: 60900, monthlyGoalCents: 30000, now });
    expect(forecast.source).toBe("minimum_pay");
    expect(forecast.months).toBe(2);
  });

  it("com o ritmo real negativo, o ordenado mínimo continua a dar previsão", () => {
    const forecast = computeForecast({
      missingCents: 60900,
      rate: { centsPerMonth: -5000, days: 60, since: now },
      minimumPayCents: 60900,
      monthlyGoalCents: 0,
      now,
    });
    expect(forecast.source).toBe("minimum_pay");
    expect(forecast.months).toBe(1);
  });
});
