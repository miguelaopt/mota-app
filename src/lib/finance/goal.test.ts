import { describe, expect, it } from "vitest";
import {
  computeCostTotals,
  computeGearTotals,
  computeGoal,
  computeProgress,
  costsForMotorcycle,
  type GoalCost,
  type GoalGearItem,
} from "./goal";

const gear = (overrides: Partial<GoalGearItem>): GoalGearItem => ({
  priceCents: 0,
  category: "protection",
  priority: "essential",
  status: "to_buy",
  ...overrides,
});

const cost = (overrides: Partial<GoalCost>): GoalCost => ({
  amountCents: 0,
  kind: "one_off",
  priority: "essential",
  motorcycleId: null,
  ...overrides,
});

const motorcycle = { id: "moto-1", priceCents: 650000 };

describe("computeGoal", () => {
  const items = [
    gear({ priceCents: 30000 }), // capacete
    gear({ priceCents: 20000, status: "bought" }), // luvas já compradas
    gear({ priceCents: 25000, category: "comfort", priority: "later" }), // Cardo
  ];
  const costs = [
    cost({ amountCents: 15000 }), // transferência
    cost({ amountCents: 10000, priority: "later" }), // primeira revisão (adiável)
    cost({ amountCents: 8000, kind: "monthly" }), // seguro mensal: não conta
  ];

  it("setup completo = mota + equipamento por comprar + custos únicos", () => {
    const goal = computeGoal({ motorcycle, gear: items, costs });
    expect(goal.full).toEqual({
      motorcycleCents: 650000,
      gearCents: 55000,
      costsCents: 25000,
      totalCents: 730000,
    });
  });

  it("mínimo considera só o essencial", () => {
    const goal = computeGoal({ motorcycle, gear: items, costs });
    expect(goal.minimum).toEqual({
      motorcycleCents: 650000,
      gearCents: 30000,
      costsCents: 15000,
      totalCents: 695000,
    });
  });

  it("itens comprados ficam fora da meta e contam como gasto", () => {
    const goal = computeGoal({ motorcycle, gear: items, costs });
    expect(goal.spentCents).toBe(20000);
  });

  it("funciona sem mota definida", () => {
    const goal = computeGoal({ motorcycle: null, gear: items, costs });
    expect(goal.full.motorcycleCents).toBe(0);
    expect(goal.full.totalCents).toBe(80000);
  });

  it("só inclui custos gerais ou da mota ativa", () => {
    const goal = computeGoal({
      motorcycle,
      gear: [],
      costs: [
        cost({ amountCents: 100 }),
        cost({ amountCents: 200, motorcycleId: "moto-1" }),
        cost({ amountCents: 400, motorcycleId: "moto-2" }),
      ],
    });
    expect(goal.full.costsCents).toBe(300);
  });
});

describe("costsForMotorcycle", () => {
  it("sem mota ativa, só os custos gerais", () => {
    const list = [cost({ motorcycleId: null }), cost({ motorcycleId: "moto-1" })];
    expect(costsForMotorcycle(list, null)).toHaveLength(1);
  });
});

describe("computeProgress", () => {
  it("calcula percentagem e falta", () => {
    expect(computeProgress(250000, 1000000)).toEqual({ pct: 25, missingCents: 750000, reached: false });
  });

  it("limita a 100% e falta a 0 quando ultrapassa", () => {
    expect(computeProgress(1200000, 1000000)).toEqual({ pct: 100, missingCents: 0, reached: true });
  });

  it("trata saldo negativo como 0", () => {
    expect(computeProgress(-5000, 1000000)).toEqual({ pct: 0, missingCents: 1000000, reached: false });
  });

  it("meta 0 conta como atingida", () => {
    expect(computeProgress(0, 0)).toEqual({ pct: 100, missingCents: 0, reached: true });
  });
});

describe("computeGearTotals", () => {
  it("soma por categoria, por prioridade e no total", () => {
    const totals = computeGearTotals([
      gear({ priceCents: 30000 }),
      gear({ priceCents: 20000, status: "bought" }),
      gear({ priceCents: 25000, category: "comfort", priority: "later" }),
      gear({ priceCents: 0, category: "other" }),
    ]);

    expect(totals.all).toEqual({ toBuyCents: 55000, boughtCents: 20000, toBuyCount: 3, boughtCount: 1 });
    expect(totals.byCategory.protection).toEqual({ toBuyCents: 30000, boughtCents: 20000, toBuyCount: 1, boughtCount: 1 });
    expect(totals.byCategory.comfort.toBuyCents).toBe(25000);
    expect(totals.byCategory.aesthetic_performance.toBuyCount).toBe(0);
    expect(totals.byPriority.essential).toEqual({ toBuyCents: 30000, boughtCents: 20000, toBuyCount: 2, boughtCount: 1 });
    expect(totals.byPriority.later.toBuyCents).toBe(25000);
    expect(totals.unpricedCount).toBe(1);
  });
});

describe("computeCostTotals", () => {
  it("separa custos únicos e mensais", () => {
    const totals = computeCostTotals(
      [
        cost({ amountCents: 15000 }),
        cost({ amountCents: 10000, priority: "later" }),
        cost({ amountCents: 3000, kind: "monthly" }),
        cost({ amountCents: 5000, kind: "monthly" }),
        cost({ amountCents: 0, kind: "monthly" }),
        cost({ amountCents: 99900, motorcycleId: "outra" }),
      ],
      "moto-1",
    );
    expect(totals).toEqual({ oneOffCents: 25000, oneOffEssentialCents: 15000, monthlyCents: 8000, unpricedCount: 1 });
  });
});
