"use server";

import type { ActionResult } from "@/lib/action-result";
import { getMoney } from "@/lib/forms";
import { check, runAction } from "@/lib/server-action";

export async function saveSettingsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, userId }) => {
    const monthlyGoal = getMoney(form, "monthly_goal", { label: "Meta mensal" });
    check(await supabase.from("settings").upsert({ user_id: userId, monthly_goal: monthlyGoal }));
  });
}
