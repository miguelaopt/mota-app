import { describe, expect, it } from "vitest";
import { countedCents, summarizeAccounts, type CountableAccount } from "./accounts";

const account = (overrides: Partial<CountableAccount>): CountableAccount => ({
  kind: "available",
  balanceCents: 0,
  countPct: 100,
  safetyMarginPct: 100,
  ...overrides,
});

describe("countedCents", () => {
  it("conta 100% de uma conta disponível por omissão", () => {
    expect(countedCents(account({ balanceCents: 150000 }))).toBe(150000);
  });

  it("aplica a percentagem da conta", () => {
    expect(countedCents(account({ balanceCents: 150000, countPct: 50 }))).toBe(75000);
  });

  it("aplica a margem de segurança só a contas investidas", () => {
    expect(countedCents(account({ kind: "invested", balanceCents: 100000, safetyMarginPct: 80 }))).toBe(80000);
    expect(countedCents(account({ kind: "available", balanceCents: 100000, safetyMarginPct: 80 }))).toBe(100000);
  });

  it("combina percentagem e margem", () => {
    // 2.000 € × 50% × 80% = 800 €
    expect(countedCents(account({ kind: "invested", balanceCents: 200000, countPct: 50, safetyMarginPct: 80 }))).toBe(80000);
  });

  it("arredonda ao cêntimo", () => {
    // 10,01 € × 33% = 3,3033 € → 3,30 €
    expect(countedCents(account({ balanceCents: 1001, countPct: 33 }))).toBe(330);
  });

  it("vale 0 sem saldo definido", () => {
    expect(countedCents(account({ balanceCents: null }))).toBe(0);
  });
});

describe("summarizeAccounts", () => {
  it("separa disponível e investido", () => {
    const summary = summarizeAccounts([
      account({ balanceCents: 100000 }),
      account({ balanceCents: 50000, countPct: 50 }),
      account({ kind: "invested", balanceCents: 200000, safetyMarginPct: 80 }),
    ]);

    expect(summary.available).toEqual({ balanceCents: 150000, countedCents: 125000, count: 2 });
    expect(summary.invested).toEqual({ balanceCents: 200000, countedCents: 160000, count: 1 });
    expect(summary.totalCountedCents).toBe(285000);
    expect(summary.missingBalanceCount).toBe(0);
  });

  it("ignora contas arquivadas e conta as que não têm saldo", () => {
    const summary = summarizeAccounts([
      account({ balanceCents: 100000, archived: true }),
      account({ balanceCents: null }),
      account({ kind: "invested", balanceCents: null }),
      account({ balanceCents: 1000 }),
    ]);

    expect(summary.totalCountedCents).toBe(1000);
    expect(summary.missingBalanceCount).toBe(2);
    expect(summary.available.count).toBe(2);
    expect(summary.invested.count).toBe(1);
  });

  it("devolve zeros sem contas", () => {
    const summary = summarizeAccounts([]);
    expect(summary.totalCountedCents).toBe(0);
    expect(summary.available.count).toBe(0);
  });
});
