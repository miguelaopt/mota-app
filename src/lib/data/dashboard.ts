import "server-only";
import { computeDashboard } from "@/lib/finance/dashboard";
import { minimumPayForGoal } from "@/lib/work/goal";
import type { Db } from "@/lib/supabase/server";
import { getAccounts } from "./accounts";
import { getCosts } from "./costs";
import { getGearItems } from "./gear";
import { getActiveMotorcycle } from "./motorcycles";
import { getSettings } from "./settings";
import { getSnapshots } from "./snapshots";
import { getWorkSettings } from "./work";

export async function getDashboardData(db: Db, now: Date) {
  const [accounts, motorcycle, gear, costs, settings, snapshots, workSettings] = await Promise.all([
    getAccounts(db),
    getActiveMotorcycle(db),
    getGearItems(db),
    getCosts(db),
    getSettings(db),
    getSnapshots(db),
    getWorkSettings(db),
  ]);
  const minimumPayCents = workSettings ? minimumPayForGoal(workSettings) : 0;

  return {
    motorcycle,
    settings,
    accounts,
    snapshots,
    workSettings,
    minimumPayCents,
    unpricedGear: gear.filter((g) => g.status === "to_buy" && g.priceCents <= 0).length,
    unpricedCosts: costs.filter((c) => c.kind === "one_off" && c.amountCents <= 0).length,
    dashboard: computeDashboard({
      accounts,
      motorcycle,
      gear,
      costs,
      snapshots,
      monthlyGoalCents: settings.monthlyGoalCents,
      minimumPayCents,
      now,
    }),
  };
}
