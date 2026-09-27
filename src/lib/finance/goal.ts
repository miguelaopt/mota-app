import type { Cents } from "./money";

export type GearCategory = "protection" | "comfort" | "aesthetic_performance" | "other";
export type ItemPriority = "essential" | "later";
export type GearStatus = "to_buy" | "bought";
export type CostKind = "one_off" | "monthly";

export const GEAR_CATEGORIES: readonly GearCategory[] = ["protection", "comfort", "aesthetic_performance", "other"];
export const ITEM_PRIORITIES: readonly ItemPriority[] = ["essential", "later"];

export interface GoalGearItem {
  priceCents: Cents;
  category: GearCategory;
  priority: ItemPriority;
  status: GearStatus;
}

export interface GoalCost {
  amountCents: Cents;
  kind: CostKind;
  priority: ItemPriority;
  /** null = aplica-se a qualquer mota. */
  motorcycleId: string | null;
}

export interface GoalMotorcycle {
  id: string;
  priceCents: Cents;
}

export interface GoalBreakdown {
  motorcycleCents: Cents;
  gearCents: Cents;
  costsCents: Cents;
  totalCents: Cents;
}

export interface Goal {
  /** Só itens e custos essenciais: o necessário para começar a andar. */
  minimum: GoalBreakdown;
  /** Tudo o que está por comprar. */
  full: GoalBreakdown;
  /** Equipamento já comprado (fora da meta). */
  spentCents: Cents;
}

export interface GoalInput {
  motorcycle: GoalMotorcycle | null;
  gear: GoalGearItem[];
  costs: GoalCost[];
}

/** Custos que se aplicam à mota ativa (os gerais e os específicos dela). */
export function costsForMotorcycle<T extends Pick<GoalCost, "motorcycleId">>(costs: T[], motorcycleId: string | null): T[] {
  return costs.filter((c) => c.motorcycleId == null || c.motorcycleId === motorcycleId);
}

/**
 * Meta = preço da mota + equipamento por comprar + custos únicos da compra.
 * O mínimo considera só o que é essencial.
 */
export function computeGoal({ motorcycle, gear, costs }: GoalInput): Goal {
  const motorcycleCents = motorcycle?.priceCents ?? 0;
  const oneOff = costsForMotorcycle(costs, motorcycle?.id ?? null).filter((c) => c.kind === "one_off");
  const toBuy = gear.filter((g) => g.status === "to_buy");

  const sum = <T>(items: T[], value: (item: T) => Cents) => items.reduce((acc, item) => acc + value(item), 0);

  const gearFull = sum(toBuy, (g) => g.priceCents);
  const gearMin = sum(
    toBuy.filter((g) => g.priority === "essential"),
    (g) => g.priceCents,
  );
  const costsFull = sum(oneOff, (c) => c.amountCents);
  const costsMin = sum(
    oneOff.filter((c) => c.priority === "essential"),
    (c) => c.amountCents,
  );

  return {
    minimum: {
      motorcycleCents,
      gearCents: gearMin,
      costsCents: costsMin,
      totalCents: motorcycleCents + gearMin + costsMin,
    },
    full: {
      motorcycleCents,
      gearCents: gearFull,
      costsCents: costsFull,
      totalCents: motorcycleCents + gearFull + costsFull,
    },
    spentCents: sum(
      gear.filter((g) => g.status === "bought"),
      (g) => g.priceCents,
    ),
  };
}

export interface Progress {
  /** 0–100 (limitado). */
  pct: number;
  missingCents: Cents;
  reached: boolean;
}

export function computeProgress(savedCents: Cents, goalCents: Cents): Progress {
  if (goalCents <= 0) {
    return { pct: savedCents >= 0 ? 100 : 0, missingCents: 0, reached: true };
  }
  const saved = Math.max(0, savedCents);
  const missingCents = Math.max(0, goalCents - saved);
  return {
    pct: Math.min(100, (saved / goalCents) * 100),
    missingCents,
    reached: missingCents === 0,
  };
}

export interface GearBucket {
  toBuyCents: Cents;
  boughtCents: Cents;
  toBuyCount: number;
  boughtCount: number;
}

export interface GearTotals {
  all: GearBucket;
  byCategory: Record<GearCategory, GearBucket>;
  byPriority: Record<ItemPriority, GearBucket>;
  /** Itens por comprar ainda sem preço. */
  unpricedCount: number;
}

export function computeGearTotals(gear: GoalGearItem[]): GearTotals {
  const bucket = (): GearBucket => ({ toBuyCents: 0, boughtCents: 0, toBuyCount: 0, boughtCount: 0 });
  const totals: GearTotals = {
    all: bucket(),
    byCategory: { protection: bucket(), comfort: bucket(), aesthetic_performance: bucket(), other: bucket() },
    byPriority: { essential: bucket(), later: bucket() },
    unpricedCount: 0,
  };

  for (const item of gear) {
    for (const b of [totals.all, totals.byCategory[item.category], totals.byPriority[item.priority]]) {
      if (item.status === "bought") {
        b.boughtCents += item.priceCents;
        b.boughtCount += 1;
      } else {
        b.toBuyCents += item.priceCents;
        b.toBuyCount += 1;
      }
    }
    if (item.status === "to_buy" && item.priceCents <= 0) totals.unpricedCount += 1;
  }

  return totals;
}

export interface CostTotals {
  oneOffCents: Cents;
  oneOffEssentialCents: Cents;
  monthlyCents: Cents;
  /** Custos ainda a 0 €. */
  unpricedCount: number;
}

export function computeCostTotals(costs: GoalCost[], motorcycleId: string | null): CostTotals {
  const totals: CostTotals = { oneOffCents: 0, oneOffEssentialCents: 0, monthlyCents: 0, unpricedCount: 0 };
  for (const cost of costsForMotorcycle(costs, motorcycleId)) {
    if (cost.kind === "one_off") {
      totals.oneOffCents += cost.amountCents;
      if (cost.priority === "essential") totals.oneOffEssentialCents += cost.amountCents;
    } else {
      totals.monthlyCents += cost.amountCents;
    }
    if (cost.amountCents <= 0) totals.unpricedCount += 1;
  }
  return totals;
}
