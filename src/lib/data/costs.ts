import "server-only";
import type { CostKind, GoalCost, ItemPriority } from "@/lib/finance/goal";
import { toCents } from "@/lib/finance/money";
import type { Db } from "@/lib/supabase/server";

export interface Cost extends GoalCost {
  id: string;
  name: string;
  kind: CostKind;
  priority: ItemPriority;
  notes: string | null;
}

export async function getCosts(db: Db): Promise<Cost[]> {
  const { data, error } = await db
    .from("costs")
    .select("id, name, amount, kind, priority, motorcycle_id, notes")
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    amountCents: toCents(row.amount),
    kind: row.kind,
    priority: row.priority,
    motorcycleId: row.motorcycle_id,
    notes: row.notes,
  }));
}
