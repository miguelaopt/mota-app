import { describe, expect, it } from "vitest";
import { dayKey, formatDayHeading, formatDuration, formatMonthYear, formatRelative } from "./dates";

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
