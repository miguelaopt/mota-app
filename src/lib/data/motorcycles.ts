import "server-only";
import { toCents, type Cents } from "@/lib/finance/money";
import type { Db } from "@/lib/supabase/server";

export interface Motorcycle {
  id: string;
  model: string;
  priceCents: Cents;
  photoPath: string | null;
  listingUrl: string | null;
  notes: string | null;
  isActive: boolean;
}

/** A mota ativa (a que define a meta). Na fase 2 haverá várias candidatas. */
export async function getActiveMotorcycle(db: Db): Promise<Motorcycle | null> {
  const { data, error } = await db
    .from("motorcycles")
    .select("id, model, price, photo_path, listing_url, notes, is_active")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    model: data.model,
    priceCents: toCents(data.price),
    photoPath: data.photo_path,
    listingUrl: data.listing_url,
    notes: data.notes,
    isActive: data.is_active,
  };
}
