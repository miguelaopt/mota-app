import "server-only";
import { toCents, type Cents } from "@/lib/finance/money";
import type { Db } from "@/lib/supabase/server";

export interface Settings {
  monthlyGoalCents: Cents;
}

export async function getSettings(db: Db): Promise<Settings> {
  const { data, error } = await db.from("settings").select("monthly_goal").maybeSingle();
  if (error) throw new Error(error.message);
  return { monthlyGoalCents: toCents(data?.monthly_goal ?? 0) };
}
