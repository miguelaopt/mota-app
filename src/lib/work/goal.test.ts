import { describe, expect, it } from "vitest";
import { formatEur } from "@/lib/finance/money";
import { formatHoursCeil } from "./format";
import { equivalentShifts, hoursToGoal, nextMilestone, referenceDuration, workForecast } from "./goal";
import { computeWorkStats, type StatsShift } from "./stats";

describe("hoursToGoal / equivalentShifts", () => {
  it("mínimo: 4.800 € a 3,85 €/h → ≈ 1.246,75 h e 250 turnos de 5h", () => {
    const r = hoursToGoal(480000, 550, 7000);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.hours).toBeCloseTo(1246.753, 3);
    expect(formatHoursCeil(r.hours)).toBe("1.247");
    expect(equivalentShifts(r.hours, 300)).toBe(250);
  });

  it("completo: 5.350 € → ≈ 1.389,61 h e 278 turnos", () => {
    const r = hoursToGoal(535000, 550, 7000);
    if (r.status !== "ok") throw new Error("esperava horas");
    expect(r.hours).toBeCloseTo(1389.61, 2);
    expect(equivalentShifts(r.hours, 300)).toBe(278);
  });

  it("sem contribuição não divide por zero", () => {
    expect(hoursToGoal(480000, 0, 7000).status).toBe("no_contribution");
    expect(hoursToGoal(480000, 550, 0).status).toBe("no_contribution");
  });

  it("meta atingida → zero restante", () => {
    expect(hoursToGoal(0, 550, 7000).status).toBe("reached");
  });

  it("turnos equivalentes precisam de uma referência", () => {
    expect(equivalentShifts(10, null)).toBeNull();
    expect(equivalentShifts(10, 0)).toBeNull();
  });

  it("referência: a definida, senão a média dos turnos", () => {
    expect(referenceDuration(240, [1])).toEqual({ minutes: 240, source: "settings" });
    expect(referenceDuration(null, [4 * 3600_000, 6 * 3600_000])).toEqual({ minutes: 300, source: "average" });
    expect(referenceDuration(null, [])).toBeNull();
  });

  it("projeção depois de um turno: 2.040 € → 2.059,25 €, faltam 4.780,75 € para o mínimo", () => {
    const saved = 204000;
    const planned = 1925;
    expect(formatEur(saved + planned)).toBe("2.059,25 €");
    expect(formatEur(684000 - (saved + planned))).toBe("4.780,75 €");
  });
});

describe("workForecast", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  it("usa só a frequência dos turnos, sem somar a meta mensal", () => {
    // 3,85 €/h × 5h × 3 turnos = 57,75 €/semana
    const f = workForecast({ missingCents: 5775, hourlyRateCents: 550, allocationBp: 7000, referencePaidMinutes: 300, shiftsPerWeek: 3, now })!;
    expect(f.centsPerWeek).toBeCloseTo(5775, 6);
    expect(f.weeks).toBeCloseTo(1, 6);
    expect(f.date.toISOString()).toBe("2026-10-15T12:00:00.000Z");
  });
  it("sem frequência ou sem contribuição não há data", () => {
    expect(workForecast({ missingCents: 1, hourlyRateCents: 550, allocationBp: 7000, referencePaidMinutes: 300, shiftsPerWeek: null, now })).toBeNull();
    expect(workForecast({ missingCents: 1, hourlyRateCents: 0, allocationBp: 7000, referencePaidMinutes: 300, shiftsPerWeek: 3, now })).toBeNull();
  });
});

describe("nextMilestone", () => {
  it("percentagens do completo, mínimo e completo", () => {
    // 27% de 7.390 € → próximo marco: 30% = 2.217 €
    expect(nextMilestone(204000, 684000, 739000)).toMatchObject({ key: "pct-30", cents: 221700 });
    expect(nextMilestone(600000, 684000, 739000)).toMatchObject({ key: "minimum" });
    expect(nextMilestone(739000, 684000, 739000)).toBeNull();
  });
});

describe("computeWorkStats", () => {
  const base = { hourlyRateCents: 550, allocationBp: 7000, plannedEndAt: null, breaks: [] };
  const shifts: StatsShift[] = [
    { ...base, id: "a", startedAt: Date.parse("2026-10-01T17:30:00Z"), endedAt: Date.parse("2026-10-01T22:30:00Z"), attributionId: "x" },
    { ...base, id: "b", startedAt: Date.parse("2026-10-07T17:30:00Z"), endedAt: Date.parse("2026-10-07T22:30:00Z"), attributionId: null },
    { ...base, id: "c", startedAt: Date.parse("2026-09-20T17:30:00Z"), endedAt: Date.parse("2026-09-20T22:30:00Z"), attributionId: null },
    { ...base, id: "d", startedAt: Date.parse("2026-10-08T17:30:00Z"), endedAt: null, attributionId: null },
  ];

  it("separa planeado de confirmado e ignora o turno ativo", () => {
    const s = computeWorkStats(shifts, [1800], new Date("2026-10-08T20:00:00Z"));
    expect(s.completedCount).toBe(3);
    expect(s.completedThisMonth).toBe(2);
    expect(s.earnedCents).toBe(3 * 2750);
    expect(s.plannedCents).toBe(3 * 1925);
    expect(s.pendingShiftIds).toEqual(["b", "c"]);
    expect(s.pendingPlannedCents).toBe(2 * 1925);
    expect(s.confirmedCents).toBe(1800);
  });
});
