import "server-only";
import type { GearCategory, GearStatus, GoalGearItem, ItemPriority } from "@/lib/finance/goal";
import { toCents } from "@/lib/finance/money";
import type { Db } from "@/lib/supabase/server";

export interface GearItem extends GoalGearItem {
  id: string;
  name: string;
  category: GearCategory;
  priority: ItemPriority;
  status: GearStatus;
  purchasedAt: string | null;
  storeUrl: string | null;
  photoPath: string | null;
  notes: string | null;
}

export async function getGearItems(db: Db): Promise<GearItem[]> {
  const { data, error } = await db
    .from("gear_items")
    .select("id, name, price, category, priority, status, purchased_at, store_url, photo_path, notes")
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    priceCents: toCents(row.price),
    category: row.category,
    priority: row.priority,
    status: row.status,
    purchasedAt: row.purchased_at,
    storeUrl: row.store_url,
    photoPath: row.photo_path,
    notes: row.notes,
  }));
}
