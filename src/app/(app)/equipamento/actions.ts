"use server";

import type { ActionResult } from "@/lib/action-result";
import { PHOTOS_BUCKET } from "@/lib/data/photos";
import { GEAR_CATEGORIES, ITEM_PRIORITIES } from "@/lib/finance/goal";
import { getEnum, getId, getMoney, getRequiredText, getText, getUrl } from "@/lib/forms";
import { check, runAction } from "@/lib/server-action";

const STATUSES = ["to_buy", "bought"] as const;

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

export async function saveGearItemAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const status = getEnum(form, "status", STATUSES, "to_buy");
    const fields = {
      name: getRequiredText(form, "name", { label: "Nome", max: 100 }),
      price: getMoney(form, "price", { label: "Preço" }),
      category: getEnum(form, "category", GEAR_CATEGORIES, "other"),
      priority: getEnum(form, "priority", ITEM_PRIORITIES, "essential"),
      status,
      store_url: getUrl(form, "store_url", { label: "Link da loja" }),
      notes: getText(form, "notes", { label: "Notas", max: 1000 }),
    };

    if (form.get("id")) {
      const id = getId(form);
      const { data: current } = await supabase.from("gear_items").select("status, purchased_at").eq("id", id).maybeSingle();
      const purchased_at = status === "bought" ? (current?.status === "bought" ? current.purchased_at : today()) : null;
      check(await supabase.from("gear_items").update({ ...fields, purchased_at }).eq("id", id));
      return;
    }

    const { data: last } = await supabase
      .from("gear_items")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    check(
      await supabase.from("gear_items").insert({
        ...fields,
        purchased_at: status === "bought" ? today() : null,
        sort_order: (last?.sort_order ?? 0) + 1,
      }),
    );
  });
}

/** Marca/desmarca como comprado (deixa de contar para o "falta"). */
export async function toggleGearBoughtAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const status = getEnum(form, "status", STATUSES, "to_buy");
    check(
      await supabase
        .from("gear_items")
        .update({ status, purchased_at: status === "bought" ? today() : null })
        .eq("id", getId(form)),
    );
  });
}

export async function deleteGearItemAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const id = getId(form);
    const { data } = await supabase.from("gear_items").select("photo_path").eq("id", id).maybeSingle();
    check(await supabase.from("gear_items").delete().eq("id", id));
    if (data?.photo_path) await supabase.storage.from(PHOTOS_BUCKET).remove([data.photo_path]);
  });
}
