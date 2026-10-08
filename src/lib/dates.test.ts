import { describe, expect, it } from "vitest";
import { dayKey, formatDayHeading, formatDuration, formatMonthYear, formatRelative, fromLocalInput, toLocalInput } from "./dates";

const now = new Date("2026-09-27T10:00:00Z");

describe("dayKey", () => {
  it("usa o dia civil de Lisboa", () => {
    // 23:30 UTC no verão já é dia seguinte em Lisboa (UTC+1)
    expect(dayKey(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(dayKey(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-01");
  });
});

describe("formatRelative", () => {
  it.each([
    ["2026-09-27T08:00:00Z", "hoje"],
    ["2026-09-26T08:00:00Z", "ontem"],
    ["2026-09-20T08:00:00Z", "há 7 dias"],
    ["2026-08-20T08:00:00Z", "há 1 mês"],
    ["2026-05-20T08:00:00Z", "há 4 meses"],
    ["2025-06-01T08:00:00Z", "há mais de um ano"],
    ["2023-06-01T08:00:00Z", "há 3 anos"],
  ])("%s → %s", (date, expected) => {
    expect(formatRelative(date, now)).toBe(expected);
  });
});

describe("formatDayHeading", () => {
  it("usa Hoje/Ontem e depois a data por extenso", () => {
    expect(formatDayHeading("2026-09-27", now)).toBe("Hoje");
    expect(formatDayHeading("2026-09-26", now)).toBe("Ontem");
    expect(formatDayHeading("2026-09-14", now)).toBe("segunda-feira, 14 de setembro");
    expect(formatDayHeading("2025-12-25", now)).toBe("25 de dezembro de 2025");
  });
});

describe("formatMonthYear", () => {
  it("formata em português", () => {
    expect(formatMonthYear(new Date("2027-03-15T12:00:00Z"))).toBe("março de 2027");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "este mês"],
    [0.4, "daqui a 1 mês"],
    [3, "daqui a 3 meses"],
    [12, "daqui a 1 ano"],
    [14.2, "daqui a 1 ano e 3 meses"],
    [25, "daqui a 2 anos e 1 mês"],
  ])("%d meses → %s", (months, expected) => {
    expect(formatDuration(months)).toBe(expected);
  });
});

describe("toLocalInput / fromLocalInput (hora de Lisboa)", () => {
  it("converte nos dois sentidos, no verão e no inverno", () => {
    expect(toLocalInput(new Date("2026-10-08T17:30:00Z"))).toBe("2026-10-08T18:30");
    expect(fromLocalInput("2026-10-08T18:30")?.toISOString()).toBe("2026-10-08T17:30:00.000Z");
    expect(fromLocalInput("2026-12-08T18:30")?.toISOString()).toBe("2026-12-08T18:30:00.000Z");
  });

  it("hora repetida quando o relógio atrasa: escolhe a primeira", () => {
    // 25 out. 2026: 02:00 WEST volta a 01:00 WET; 01:30 acontece duas vezes.
    expect(fromLocalInput("2026-10-25T01:30")?.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("hora inexistente quando o relógio adianta", () => {
    // 29 mar. 2026: 01:00 WET passa a 02:00 WEST; 01:30 não existe.
    expect(fromLocalInput("2026-03-29T01:30")?.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("rejeita texto inválido", () => {
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("2026-02-31T10:00")).toBeNull();
    expect(fromLocalInput("ontem")).toBeNull();
  });
});
