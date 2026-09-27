"use server";

import type { ActionResult } from "@/lib/action-result";
import { ITEM_PRIORITIES } from "@/lib/finance/goal";
import { getEnum, getId, getMoney, getRequiredText, getText } from "@/lib/forms";
import { check, runAction } from "@/lib/server-action";

const KINDS = ["one_off", "monthly"] as const;

export async function saveCostAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const kind = getEnum(form, "kind", KINDS, "one_off");
    const fields = {
      name: getRequiredText(form, "name", { label: "Nome", max: 100 }),
      amount: getMoney(form, "amount", { label: "Valor" }),
      // A prioridade só se aplica aos custos da compra (os mensais não entram na meta).
      priority: kind === "one_off" ? getEnum(form, "priority", ITEM_PRIORITIES, "essential") : ("essential" as const),
      notes: getText(form, "notes", { label: "Notas", max: 1000 }),
    };

    if (form.get("id")) {
      check(await supabase.from("costs").update(fields).eq("id", getId(form)));
      return;
    }

    const { data: last } = await supabase
      .from("costs")
      .select("sort_order")
      .eq("kind", kind)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    check(await supabase.from("costs").insert({ ...fields, kind, sort_order: (last?.sort_order ?? 0) + 1 }));
  });
}

export async function deleteCostAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("costs").delete().eq("id", getId(form)));
  });
}
