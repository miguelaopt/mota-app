import { describe, expect, it } from "vitest";
import { formatClock, formatHm } from "./format";
import {
  estimateAtPlannedEnd,
  estimatePlannedShift,
  estimateShift,
  isUnusualShift,
  monthlyToHourlyCents,
  pctToBp,
  validateShiftTimes,
  type ShiftBreak,
  type ShiftTerms,
  type ShiftTiming,
} from "./shift";

const at = (iso: string) => Date.parse(iso);
const terms: ShiftTerms = { hourlyRateCents: 550, allocationBp: 7000 };

// 18:30–23:30 em Lisboa (outubro, UTC+1).
const start = at("2026-10-08T17:30:00Z");
const end = at("2026-10-08T22:30:00Z");

const shift = (overrides: Partial<ShiftTiming> = {}): ShiftTiming & ShiftTerms => ({
  startedAt: start,
  endedAt: end,
  plannedEndAt: end,
  breaks: [],
  ...terms,
  ...overrides,
});

const pause = (from: string, to: string | null, paid: boolean): ShiftBreak => ({
  id: `${from}-${paid}`,
  startedAt: at(from),
  endedAt: to ? at(to) : null,
  paid,
});

describe("estimateShift — critérios de aceitação", () => {
  it("5h pagas, 5,50 €/h, 70% → 27,50 € estimados e 19,25 € planeados", () => {
    const e = estimateShift(shift(), end);
    expect(formatHm(e.paidMs)).toBe("5h00");
    expect(e.earnedCents).toBe(2750);
    expect(e.plannedCents).toBe(1925);
  });

  it("30 min de pausa não remunerada → 4h30 pagas, 24,75 € e 17,33 €", () => {
    const e = estimateShift(shift({ breaks: [pause("2026-10-08T19:00:00Z", "2026-10-08T19:30:00Z", false)] }), end);
    expect(formatHm(e.paidMs)).toBe("4h30");
    expect(e.earnedCents).toBe(2475);
    expect(e.plannedCents).toBe(1733);
    expect(formatHm(e.breakMs)).toBe("0h30");
  });

  it("pausa remunerada de 30 min mantém 5h pagas e 27,50 €", () => {
    const e = estimateShift(shift({ breaks: [pause("2026-10-08T19:00:00Z", "2026-10-08T19:30:00Z", true)] }), end);
    expect(formatHm(e.paidMs)).toBe("5h00");
    expect(e.earnedCents).toBe(2750);
    expect(formatHm(e.breakMs)).toBe("0h30");
    expect(e.unpaidBreakMs).toBe(0);
  });

  it("turno em curso às 20:42 (entrada 18:30): 2h12, 12,10 €, 8,47 € e faltam 2h48", () => {
    const now = at("2026-10-08T19:42:00Z");
    const e = estimateShift(shift({ endedAt: null }), now);
    expect(formatHm(e.paidMs)).toBe("2h12");
    expect(e.earnedCents).toBe(1210);
    expect(e.plannedCents).toBe(847);
    expect(formatHm(e.remainingMs!)).toBe("2h48");
    expect(e.overtimeMs).toBe(0);
  });

  it("fechar a app durante 4 horas não perde tempo: tudo vem dos instantes", () => {
    const later = at("2026-10-08T21:30:00Z");
    const e = estimateShift(shift({ endedAt: null }), later);
    expect(formatHm(e.paidMs)).toBe("4h00");
    expect(e.earnedCents).toBe(2200);
  });

  it("pausa não paga a decorrer suspende a contagem; a paga não", () => {
    const now = at("2026-10-08T19:00:00Z");
    const unpaid = estimateShift(shift({ endedAt: null, breaks: [pause("2026-10-08T18:30:00Z", null, false)] }), now);
    expect(formatHm(unpaid.paidMs)).toBe("1h00");
    expect(unpaid.openBreak).not.toBeNull();
    const paid = estimateShift(shift({ endedAt: null, breaks: [pause("2026-10-08T18:30:00Z", null, true)] }), now);
    expect(formatHm(paid.paidMs)).toBe("1h30");
  });

  it("saída prevista ultrapassada: sem countdown negativo", () => {
    const now = at("2026-10-08T22:42:00Z");
    const e = estimateShift(shift({ endedAt: null }), now);
    expect(e.remainingMs).toBe(0);
    expect(formatHm(e.overtimeMs)).toBe("0h12");
  });

  it("valor/hora ou percentagem zero não dá erros", () => {
    expect(estimateShift({ ...shift(), hourlyRateCents: 0 }, end).earnedCents).toBe(0);
    expect(estimateShift({ ...shift(), allocationBp: 0 }, end).plannedCents).toBe(0);
  });

  it("pausas sobrepostas não são descontadas duas vezes", () => {
    const e = estimateShift(
      shift({
        breaks: [
          pause("2026-10-08T19:00:00Z", "2026-10-08T19:30:00Z", false),
          pause("2026-10-08T19:15:00Z", "2026-10-08T19:45:00Z", false),
        ],
      }),
      end,
    );
    expect(formatHm(e.paidMs)).toBe("4h15");
  });
});

describe("turnos que atravessam a meia-noite ou a mudança de hora", () => {
  it("atravessa a meia-noite", () => {
    const e = estimateShift(shift({ startedAt: at("2026-10-08T21:00:00Z"), endedAt: at("2026-10-09T02:00:00Z"), plannedEndAt: null }), 0);
    expect(formatHm(e.paidMs)).toBe("5h00");
  });

  it("noite em que o relógio atrasa (25 out. 2026): 23:30–03:30 locais são 5h reais", () => {
    // 23:30 WEST = 22:30Z; 03:30 WET = 03:30Z
    const e = estimateShift(shift({ startedAt: at("2026-10-24T22:30:00Z"), endedAt: at("2026-10-25T03:30:00Z"), plannedEndAt: null }), 0);
    expect(formatHm(e.paidMs)).toBe("5h00");
    expect(e.earnedCents).toBe(2750);
  });
});

describe("estimativas auxiliares", () => {
  it("estimativa na saída prevista conta uma pausa aberta como terminada agora", () => {
    const now = at("2026-10-08T19:00:00Z");
    const e = estimateAtPlannedEnd(shift({ endedAt: null, breaks: [pause("2026-10-08T18:30:00Z", null, false)] }), now)!;
    expect(formatHm(e.paidMs)).toBe("4h30");
  });

  it("turno planeado: duração paga, ganhos e parcela", () => {
    const e = estimatePlannedShift({ startsAt: start, endsAt: end, unpaidBreakMinutes: 0 }, terms);
    expect(e.earnedCents).toBe(2750);
    expect(e.plannedCents).toBe(1925);
  });

  it("salário fixo: equivalente horário = salário ÷ horas", () => {
    expect(monthlyToHourlyCents(85000, 130)).toBe(654);
    expect(monthlyToHourlyCents(85000, 0)).toBe(0);
  });

  it("percentagem → pontos base", () => {
    expect(pctToBp(70)).toBe(7000);
    expect(pctToBp(72.5)).toBe(7250);
    expect(pctToBp(150)).toBe(10000);
  });

  it("assinala durações invulgares", () => {
    expect(isUnusualShift(estimateShift(shift(), end))).toBe(false);
    expect(isUnusualShift(estimateShift(shift({ endedAt: end + 13 * 3600_000 }), 0))).toBe(true);
  });

  it("timer", () => {
    expect(formatClock(2 * 3600_000 + 12 * 60_000 + 5_000)).toBe("2:12:05");
  });
});

describe("validateShiftTimes", () => {
  const ok = { startedAt: start, endedAt: end, breaks: [] };
  it("aceita um turno normal", () => {
    expect(validateShiftTimes(ok)).toBeNull();
  });
  it("rejeita saída antes da entrada", () => {
    expect(validateShiftTimes({ ...ok, endedAt: start - 1 })).toMatch(/depois da entrada/);
  });
  it("rejeita pausas fora do turno ou sobrepostas", () => {
    expect(validateShiftTimes({ ...ok, breaks: [{ startedAt: start - 1, endedAt: start + 1 }] })).toMatch(/antes da entrada/);
    expect(validateShiftTimes({ ...ok, breaks: [{ startedAt: end - 1, endedAt: end + 1 }] })).toMatch(/depois da saída/);
    expect(
      validateShiftTimes({
        ...ok,
        breaks: [
          { startedAt: start + 10, endedAt: start + 100 },
          { startedAt: start + 50, endedAt: start + 200 },
        ],
      }),
    ).toMatch(/sobrepostas/);
  });
});
