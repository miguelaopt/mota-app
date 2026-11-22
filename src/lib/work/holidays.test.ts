import { describe, expect, it } from "vitest";
import { fromLocalInput } from "@/lib/dates";
import {
  DEFAULT_HOLIDAY_RULES,
  easterSunday,
  formatMunicipalHoliday,
  formatPremium,
  holidayName,
  holidayPaidMs,
  holidaysOfYear,
  parseMunicipalHoliday,
  plannedHolidayPaidMs,
} from "./holidays";
import { estimatePlannedShift, estimateShift, HOUR_MS } from "./shift";

const at = (local: string) => fromLocalInput(local)!.getTime();
const rules = DEFAULT_HOLIDAY_RULES; // +50%, sem municipal nem Carnaval

describe("feriados de Portugal", () => {
  it("Páscoa em vários anos", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("os 13 feriados obrigatórios de 2026, com os móveis certos", () => {
    const days = holidaysOfYear(2026, rules);
    expect(days.size).toBe(13);
    expect(days.get("2026-04-03")).toBe("Sexta-feira Santa");
    expect(days.get("2026-04-05")).toBe("Páscoa");
    expect(days.get("2026-06-04")).toBe("Corpo de Deus");
    expect(days.get("2026-12-08")).toBe("Imaculada Conceição");
    expect(days.has("2026-02-17")).toBe(false); // Carnaval não é obrigatório
  });

  it("Carnaval e feriado municipal só quando definidos", () => {
    expect(holidayName("2027-02-09", { municipal: null, carnival: true })).toBe("Carnaval");
    expect(holidayName("2027-02-09", rules)).toBeNull();
    expect(holidayName("2026-06-13", { municipal: "06-13", carnival: false })).toBe("Feriado municipal");
    // Um municipal que coincide com um nacional fica com o nome do nacional.
    expect(holidayName("2026-06-10", { municipal: "06-10", carnival: false })).toBe("Dia de Portugal");
  });
});

describe("tempo pago em feriado", () => {
  it("turno todo no Natal, sem a pausa não paga", () => {
    const shift = {
      startedAt: at("2026-12-25T18:30"),
      endedAt: at("2026-12-25T23:30"),
      breaks: [{ startedAt: at("2026-12-25T20:45"), endedAt: at("2026-12-25T21:15"), paid: false }],
    };
    expect(holidayPaidMs(shift, shift.endedAt, rules)).toBe(4.5 * HOUR_MS);
  });

  it("turno que passa a meia-noite para o Ano Novo: só conta a parte do dia 1", () => {
    const shift = { startedAt: at("2026-12-31T20:00"), endedAt: at("2027-01-01T01:30"), breaks: [] };
    expect(holidayPaidMs(shift, shift.endedAt, rules)).toBe(1.5 * HOUR_MS);
  });

  it("dia normal: nada", () => {
    const shift = { startedAt: at("2026-11-21T18:30"), endedAt: at("2026-11-21T23:30"), breaks: [] };
    expect(holidayPaidMs(shift, shift.endedAt, rules)).toBe(0);
  });

  it("turno a decorrer num feriado conta até agora", () => {
    const shift = { startedAt: at("2026-12-08T18:30"), endedAt: null, breaks: [] };
    expect(holidayPaidMs(shift, at("2026-12-08T20:00"), rules)).toBe(1.5 * HOUR_MS);
  });

  it("turno planeado: proporcional à parte que cai no feriado", () => {
    const plan = { startsAt: at("2026-12-24T22:00"), endsAt: at("2026-12-25T02:00") };
    // Metade do turno no Natal; 3h30 pagas (30 min de pausa) → 1h45 em feriado.
    expect(plannedHolidayPaidMs(plan, 3.5 * HOUR_MS, rules)).toBe(1.75 * HOUR_MS);
  });
});

describe("ganhos com acréscimo de feriado", () => {
  const terms = { hourlyRateCents: 472, allocationBp: 10000 };
  const christmas = {
    startedAt: at("2026-12-25T18:30"),
    endedAt: at("2026-12-25T23:30"),
    plannedEndAt: null,
    breaks: [{ id: "p", startedAt: at("2026-12-25T20:45"), endedAt: at("2026-12-25T21:15"), paid: false }],
  };

  it("+50%: 4h30 no Natal a 4,72 €/h = 31,86 €", () => {
    const e = estimateShift({ ...christmas, ...terms, holiday: rules }, christmas.endedAt);
    expect(e.holidayPaidMs).toBe(4.5 * HOUR_MS);
    // 4,5 h × 4,72 € × 1,5 = 31,86 €
    expect(e.earnedCents).toBe(3186);
    expect(e.plannedCents).toBe(3186);
  });

  it("a dobrar (+100%): 42,48 €", () => {
    const e = estimateShift({ ...christmas, ...terms, holiday: { ...rules, premiumBp: 10000 } }, christmas.endedAt);
    expect(e.earnedCents).toBe(4248);
  });

  it("sem regras (ou 0%) fica como antes: 21,24 €", () => {
    expect(estimateShift({ ...christmas, ...terms }, christmas.endedAt).earnedCents).toBe(2124);
    expect(estimateShift({ ...christmas, ...terms, holiday: { ...rules, premiumBp: 0 } }, christmas.endedAt).earnedCents).toBe(2124);
  });

  it("turno planeado num feriado já mostra o acréscimo", () => {
    const plan = { startsAt: at("2026-12-08T18:30"), endsAt: at("2026-12-08T23:30"), unpaidBreakMinutes: 30 };
    const e = estimatePlannedShift(plan, { ...terms, holiday: rules });
    expect(e.paidMs).toBe(4.5 * HOUR_MS);
    expect(e.holidayPaidMs).toBe(4.5 * HOUR_MS);
    expect(e.plannedCents).toBe(3186);
    // Três dias depois (11 de dezembro) já não é feriado.
    const normal = { ...plan, startsAt: plan.startsAt + 3 * 24 * HOUR_MS, endsAt: plan.endsAt + 3 * 24 * HOUR_MS };
    expect(estimatePlannedShift(normal, { ...terms, holiday: rules }).plannedCents).toBe(2124);
  });
});

describe("formatos", () => {
  it("percentagem e feriado municipal", () => {
    expect(formatPremium(5000)).toBe("+50%");
    expect(formatPremium(12550)).toBe("+125,5%");
    expect(parseMunicipalHoliday("13/06")).toBe("06-13");
    expect(parseMunicipalHoliday(" 1-5 ")).toBe("05-01");
    expect(parseMunicipalHoliday("")).toBeNull();
    expect(parseMunicipalHoliday("31/04")).toBeUndefined();
    expect(parseMunicipalHoliday("29/02")).toBe("02-29");
    expect(parseMunicipalHoliday("junho")).toBeUndefined();
    expect(formatMunicipalHoliday("06-13")).toBe("13/06");
    expect(formatMunicipalHoliday(null)).toBe("");
  });
});
