import { describe, expect, it } from "vitest";
import type { CountableAccount } from "./accounts";
import { computeDashboard, type DashboardInput } from "./dashboard";
import type { BalanceSnapshot } from "./history";

const now = new Date("2026-06-01T12:00:00Z");

const account = (overrides: Partial<CountableAccount>): CountableAccount => ({
  kind: "available",
  balanceCents: 0,
  countPct: 100,
  safetyMarginPct: 100,
  ...overrides,
});

const snap = (accountId: string, iso: string, balanceCents: number): BalanceSnapshot => ({
  accountId,
  recordedAt: new Date(`${iso}T12:00:00Z`),
  balanceCents,
  kind: "available",
  countPct: 100,
  safetyMarginPct: 100,
});

const base: DashboardInput = {
  accounts: [account({ balanceCents: 300000 }), account({ kind: "invested", balanceCents: 250000, safetyMarginPct: 80 })],
  motorcycle: { id: "m1", priceCents: 650000 },
  gear: [
    { priceCents: 35000, category: "protection", priority: "essential", status: "to_buy" },
    { priceCents: 20000, category: "comfort", priority: "later", status: "to_buy" },
    { priceCents: 6000, category: "protection", priority: "essential", status: "bought" },
  ],
  costs: [
    { amountCents: 15000, kind: "one_off", priority: "essential", motorcycleId: null },
    { amountCents: 10000, kind: "one_off", priority: "later", motorcycleId: null },
    { amountCents: 4000, kind: "monthly", priority: "essential", motorcycleId: null },
  ],
  snapshots: [],
  monthlyGoalCents: 50000,
  now,
};

describe("computeDashboard", () => {
  it("junta totais, metas e progresso", () => {
    const d = computeDashboard(base);
    // 3.000 € + 2.500 € × 80%
    expect(d.savedCents).toBe(500000);
    // 6.500 + 350 + 200 + 150 + 100
    expect(d.full.totalCents).toBe(730000);
    // 6.500 + 350 + 150
    expect(d.minimum.totalCents).toBe(700000);
    expect(d.full.missingCents).toBe(230000);
    expect(d.minimum.missingCents).toBe(200000);
    expect(d.goal.spentCents).toBe(6000);
    expect(d.minimumMarkPct).toBeCloseTo((700000 / 730000) * 100, 6);
  });

  it("sem histórico, usa a meta mensal para a previsão", () => {
    const d = computeDashboard(base);
    expect(d.rate).toBeNull();
    expect(d.minimum.forecast.source).toBe("monthly_goal");
    expect(d.minimum.forecast.months).toBe(4);
    expect(d.full.forecast.months).toBeCloseTo(4.6, 6);
  });

  it("com histórico, usa o ritmo real", () => {
    const d = computeDashboard({
      ...base,
      snapshots: [snap("a", "2026-01-01", 200000), snap("a", "2026-05-31", 300000)],
    });
    expect(d.rate).not.toBeNull();
    expect(d.full.forecast.source).toBe("history");
  });

  it("marca a meta como atingida", () => {
    const d = computeDashboard({ ...base, accounts: [account({ balanceCents: 800000 })] });
    expect(d.full.reached).toBe(true);
    expect(d.full.pct).toBe(100);
    expect(d.full.forecast.source).toBe("reached");
  });

  it("funciona sem nada definido", () => {
    const d = computeDashboard({ ...base, accounts: [], motorcycle: null, gear: [], costs: [], monthlyGoalCents: 0 });
    expect(d.savedCents).toBe(0);
    expect(d.full.totalCents).toBe(0);
    expect(d.minimumMarkPct).toBe(0);
  });
});
