import type { Metadata } from "next";
import { Notice } from "@/components/ui/Badge";
import { Card, Section, StatRow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { getGearItems } from "@/lib/data/gear";
import { signPhotoUrls } from "@/lib/data/photos";
import { formatShortDate } from "@/lib/dates";
import { computeGearTotals, GEAR_CATEGORIES, ITEM_PRIORITIES, type GearBucket } from "@/lib/finance/goal";
import { formatEur } from "@/lib/finance/money";
import { GEAR_CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import { GearList, type GearRow } from "./GearList";

export const metadata: Metadata = { title: "Equipamento" };

function bucketValue(bucket: GearBucket) {
  return (
    <span className="text-right">
      {formatEur(bucket.toBuyCents)}
      {bucket.boughtCents > 0 && <span className="block text-xs text-muted">comprado {formatEur(bucket.boughtCents)}</span>}
    </span>
  );
}

export default async function GearPage() {
  const { supabase, userId } = await requireSession();
  const items = await getGearItems(supabase);
  const photos = await signPhotoUrls(
    supabase,
    items.map((item) => item.photoPath),
  );
  const totals = computeGearTotals(items);
  const now = new Date();

  const rows: GearRow[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    priceCents: item.priceCents,
    category: item.category,
    priority: item.priority,
    status: item.status,
    storeUrl: item.storeUrl,
    notes: item.notes,
    photoUrl: item.photoPath ? (photos[item.photoPath] ?? null) : null,
    purchasedLabel: item.purchasedAt ? `comprado a ${formatShortDate(`${item.purchasedAt}T12:00:00Z`, now)}` : null,
  }));

  return (
    <>
      <PageHeader title="Equipamento" />

      <Card>
        <p className="text-sm text-muted">Por comprar</p>
        <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums">{formatEur(totals.all.toBuyCents)}</p>
        <div className="mt-3 border-t border-sep pt-2">
          <StatRow label="Essencial" value={formatEur(totals.byPriority.essential.toBuyCents)} />
          <StatRow label="Para depois" value={formatEur(totals.byPriority.later.toBuyCents)} />
          <StatRow
            label="Já comprado"
            hint="Fora da meta, registado como gasto"
            value={<span className="text-success">{formatEur(totals.all.boughtCents)}</span>}
          />
        </div>
      </Card>

      {totals.unpricedCount > 0 && (
        <Notice className="mt-4">
          {totals.unpricedCount === 1 ? "1 item ainda não tem preço." : `${totals.unpricedCount} itens ainda não têm preço.`} Toca num
          item para o definir.
        </Notice>
      )}

      <GearList items={rows} userId={userId} />

      <Section title="Por categoria">
        <Card className="py-2">
          {GEAR_CATEGORIES.map((category) => (
            <StatRow key={category} label={GEAR_CATEGORY_LABEL[category]} value={bucketValue(totals.byCategory[category])} />
          ))}
        </Card>
      </Section>

      <Section title="Por prioridade">
        <Card className="py-2">
          {ITEM_PRIORITIES.map((priority) => (
            <StatRow key={priority} label={PRIORITY_LABEL[priority]} value={bucketValue(totals.byPriority[priority])} />
          ))}
        </Card>
      </Section>
    </>
  );
}
