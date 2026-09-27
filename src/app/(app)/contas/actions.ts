"use server";

import type { ActionResult } from "@/lib/action-result";
import { getEnum, getId, getMoney, getOptionalMoney, getPercent, getRequiredText } from "@/lib/forms";
import { check, runAction } from "@/lib/server-action";

const KINDS = ["available", "invested"] as const;

/** Atualização rápida do saldo (o trigger guarda o registo no histórico). */
export async function updateBalanceAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const id = getId(form);
    const balance = getMoney(form, "balance", { label: "Saldo", required: true });
    check(await supabase.from("accounts").update({ balance }).eq("id", id));
  });
}

export async function saveAccountAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const id = form.get("id") ? getId(form) : null;
    const kind = getEnum(form, "kind", KINDS, "available");
    const fields = {
      name: getRequiredText(form, "name", { label: "Nome", max: 60 }),
      kind,
      count_pct: getPercent(form, "count_pct", { label: "Percentagem que conta" }),
      safety_margin_pct: kind === "invested" ? getPercent(form, "safety_margin_pct", { label: "Margem de segurança" }) : 100,
    };

    if (id) {
      check(await supabase.from("accounts").update(fields).eq("id", id));
      return;
    }

    const { data: last } = await supabase
      .from("accounts")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    check(
      await supabase.from("accounts").insert({
        ...fields,
        balance: getOptionalMoney(form, "balance", { label: "Saldo" }),
        sort_order: (last?.sort_order ?? 0) + 1,
      }),
    );
  });
}

/** "Remover" arquiva a conta: deixa de contar, mas o histórico mantém-se. */
export async function archiveAccountAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("accounts").update({ archived_at: new Date().toISOString() }).eq("id", getId(form)));
  });
}

export async function restoreAccountAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("accounts").update({ archived_at: null }).eq("id", getId(form)));
  });
}
