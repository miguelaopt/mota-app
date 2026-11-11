import type { Metadata } from "next";
import { Notice } from "@/components/ui/Badge";
import { Card, Section, StatRow } from "@/components/ui/Card";
import { PlanningTabs } from "@/components/PlanningTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { getCosts } from "@/lib/data/costs";
import { getActiveMotorcycle } from "@/lib/data/motorcycles";
import { computeCostTotals, costsForMotorcycle } from "@/lib/finance/goal";
import { formatEur } from "@/lib/finance/money";
import { CostsList, type CostRow } from "./CostsList";

export const metadata: Metadata = { title: "Custos" };

export default async function CostsPage() {
  const { supabase } = await requireSession();
  const [allCosts, motorcycle] = await Promise.all([getCosts(supabase), getActiveMotorcycle(supabase)]);
  const motorcycleId = motorcycle?.id ?? null;
  const costs = costsForMotorcycle(allCosts, motorcycleId);
  const totals = computeCostTotals(costs, motorcycleId);

  const toRow = (cost: (typeof costs)[number]): CostRow => ({
    id: cost.id,
    name: cost.name,
    amountCents: cost.amountCents,
    priority: cost.priority,
    notes: cost.notes,
  });

  return (
    <>
      <PageHeader title="Custos" />
      <PlanningTabs current="/custos" />

      <Card className="grid grid-cols-2 gap-3 p-[1.125rem]">
        <div>
          <p className="eyebrow">Da compra</p>
          <p className="display mt-1.5 text-[2rem]">{formatEur(totals.oneOffCents)}</p>
          <p className="mt-1 text-xs text-muted">conta para a meta</p>
        </div>
        <div className="border-l border-sep pl-3">
          <p className="eyebrow">Por mês, depois</p>
          <p className="display mt-1.5 text-[2rem]">{formatEur(totals.monthlyCents)}</p>
          <p className="mt-1 text-xs text-muted">≈ {formatEur(totals.monthlyCents * 12, { hideZeroCents: true })} por ano</p>
        </div>
      </Card>

      {totals.unpricedCount > 0 && (
        <Notice className="mt-3">
          {totals.unpricedCount === 1 ? "1 custo ainda não tem valor." : `${totals.unpricedCount} custos ainda não têm valor.`} Toca num
          custo para o definir.
        </Notice>
      )}

      <Section title="Custos da compra">
        <p className="-mt-1 mb-2 px-1 text-[0.8125rem] text-muted">Pagos uma vez, quando comprares a mota. Contam para a meta.</p>
        <CostsList kind="one_off" costs={costs.filter((c) => c.kind === "one_off").map(toRow)} />
        <Card className="mt-3 py-2">
          <StatRow label="Essenciais" value={formatEur(totals.oneOffEssentialCents)} />
          <StatRow label="Total" value={formatEur(totals.oneOffCents)} strong />
        </Card>
      </Section>

      <Section title="Custos mensais">
        <p className="-mt-1 mb-2 px-1 text-[0.8125rem] text-muted">Depois da compra. Só informativos: não contam para a meta.</p>
        <CostsList kind="monthly" costs={costs.filter((c) => c.kind === "monthly").map(toRow)} />
        <Card className="mt-3 py-2">
          <StatRow label="Total mensal estimado" value={formatEur(totals.monthlyCents)} strong />
        </Card>
      </Section>
    </>
  );
}
