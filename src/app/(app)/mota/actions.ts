"use server";

import type { ActionResult } from "@/lib/action-result";
import { getId, getMoney, getRequiredText, getText, getUrl } from "@/lib/forms";
import { check, runAction } from "@/lib/server-action";

export async function saveMotorcycleAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const fields = {
      model: getRequiredText(form, "model", { label: "Modelo", max: 100 }),
      price: getMoney(form, "price", { label: "Preço", required: true }),
      listing_url: getUrl(form, "listing_url", { label: "Link do anúncio" }),
      notes: getText(form, "notes", { label: "Notas", max: 1000 }),
    };

    if (form.get("id")) {
      check(await supabase.from("motorcycles").update(fields).eq("id", getId(form)));
      return;
    }

    // Primeira mota: fica logo como ativa (é a que define a meta).
    const { data: active } = await supabase.from("motorcycles").select("id").eq("is_active", true).maybeSingle();
    check(await supabase.from("motorcycles").insert({ ...fields, is_active: !active }));
  });
}
