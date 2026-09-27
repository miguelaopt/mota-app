"use server";

import type { ActionResult } from "@/lib/action-result";
import { FormError } from "@/lib/forms";
import { check, runAction } from "@/lib/server-action";

/** Apaga um registo do histórico (para corrigir um engano). O saldo atual da conta não muda. */
export async function deleteSnapshotAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const id = Number(form.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) throw new FormError("Pedido inválido.");
    check(await supabase.from("balance_snapshots").delete().eq("id", id));
  });
}
