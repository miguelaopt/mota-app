import "server-only";
import { computeDashboard } from "@/lib/finance/dashboard";
import type { Db } from "@/lib/supabase/server";
import { getAccounts } from "./accounts";
import { getCosts } from "./costs";
import { getGearItems } from "./gear";
import { getActiveMotorcycle } from "./motorcycles";
import { getSettings } from "./settings";
import { getSnapshots } from "./snapshots";

export async function getDashboardData(db: Db, now: Date) {
  const [accounts, motorcycle, gear, costs, settings, snapshots] = await Promise.all([
    getAccounts(db),
    getActiveMotorcycle(db),
    getGearItems(db),
    getCosts(db),
    getSettings(db),
    getSnapshots(db),
  ]);

  return {
    motorcycle,
    settings,
    unpricedGear: gear.filter((g) => g.status === "to_buy" && g.priceCents <= 0).length,
    unpricedCosts: costs.filter((c) => c.kind === "one_off" && c.amountCents <= 0).length,
    dashboard: computeDashboard({
      accounts,
      motorcycle,
      gear,
      costs,
      snapshots,
      monthlyGoalCents: settings.monthlyGoalCents,
      now,
    }),
  };
}
