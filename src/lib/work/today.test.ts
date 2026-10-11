import { describe, expect, it } from "vitest";
import { applyWorkOp, parseWorkOp, type CompletedClockShift } from "./clock";
import { estimateShift } from "./shift";
import { addMinutesToTime, todayView } from "./today";
import type { CalendarEntry } from "./view";

const H = 3600_000;
const at = (iso: string) => Date.parse(iso);
const settings = {
  jobName: "Pizza Hut",
  payMode: "hourly" as const,
  hourlyRateCents: 550,
  allocationBp: 7000,
  target: "minimum" as const,
  paidBreaks: false,
  haptics: true,
  animations: true,
};

const entry = (id: string, startIso: string, overrides: Partial<CalendarEntry> = {}): CalendarEntry => ({
  id,
  startsAt: at(startIso),
  endsAt: at(startIso) + 5 * H,
  unpaidBreakMinutes: 0,
  status: "planned",
  shiftId: null,
  doneCents: null,
  ...overrides,
});

describe("todayView", () => {
  // 11 out. 2026, 21:00 em Lisboa (20:00Z)
  const now = at("2026-10-11T20:00:00Z");
  const calendar = [
    entry("a0000000-0000-4000-8000-000000000001", "2026-10-09T17:30:00Z"), // sexta, esquecido
    entry("a0000000-0000-4000-8000-000000000002", "2026-10-11T17:30:00Z"), // hoje, a decorrer
    entry("a0000000-0000-4000-8000-000000000003", "2026-10-12T17:30:00Z"), // amanhã
    entry("a0000000-0000-4000-8000-000000000004", "2026-09-01T17:30:00Z"), // demasiado antigo
  ];

  it("mostra o turno de hoje com «Turno feito», os esquecidos e o próximo", () => {
    const v = todayView({ calendar, settings }, [], now);
    expect(v.main?.id).toBe(calendar[1].id);
    expect(v.others.map((e) => e.id)).toEqual([calendar[0].id]);
    expect(v.next?.id).toBe(calendar[2].id);
    expect(v.doneToday).toBeNull();
  });

  it("depois de marcar (mesmo offline), hoje aparece como feito com 19,25 €", () => {
    const v = todayView({ calendar, settings }, [calendar[1].id, calendar[0].id], now);
    expect(v.main).toBeNull();
    expect(v.doneToday).toEqual({ cents: 1925 });
  });

  it("um turno que ainda não começou não pode ser marcado", () => {
    const v = todayView({ calendar, settings }, [], at("2026-10-11T12:00:00Z"));
    expect(v.main?.id).toBe(calendar[0].id);
    expect(v.next?.id).toBe(calendar[1].id);
  });
});

describe("addMinutesToTime", () => {
  it("soma 5h e dá a volta à meia-noite", () => {
    expect(addMinutesToTime("18:30", 300)).toBe("23:30");
    expect(addMinutesToTime("21:00", 300)).toBe("02:00");
  });
});

describe("operação «Turno feito»", () => {
  const shift: CompletedClockShift = {
    id: "a0000000-0000-4000-8000-000000000002",
    startedAt: at("2026-10-11T17:30:00Z"),
    endedAt: at("2026-10-11T22:30:00Z"),
    plannedEndAt: at("2026-10-11T22:30:00Z"),
    scheduledShiftId: "a0000000-0000-4000-8000-000000000002",
    motorcycleId: null,
    payMode: "hourly",
    hourlyRateCents: 550,
    allocationBp: 7000,
    target: "minimum",
    breaks: [],
  };

  it("regista o turno de 5h: 27,50 € estimados e 19,25 € para a mota", () => {
    const r = applyWorkOp({ active: null, lastCompleted: null }, { type: "complete", shift });
    if (!r.ok) throw new Error(r.error);
    const e = estimateShift(r.state.lastCompleted!, r.state.lastCompleted!.endedAt);
    expect(e.earnedCents).toBe(2750);
    expect(e.plannedCents).toBe(1925);
    // Duplo toque: não muda nada.
    expect(applyWorkOp(r.state, { type: "complete", shift })).toEqual({ ok: true, state: r.state });
  });

  it("valida o que chega ao servidor", () => {
    expect(parseWorkOp({ type: "complete", shift })).toEqual({ type: "complete", shift });
    expect(parseWorkOp({ type: "complete", shift: { ...shift, endedAt: shift.startedAt } })).toBeNull();
    expect(parseWorkOp({ type: "complete", shift: { ...shift, breaks: [{ id: "x" }] } })).toBeNull();
  });
});
