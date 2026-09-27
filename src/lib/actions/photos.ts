"use server";

import type { ActionResult } from "@/lib/action-result";
import { PHOTOS_BUCKET } from "@/lib/data/photos";
import { FormError } from "@/lib/forms";
import { check, runAction } from "@/lib/server-action";

export type PhotoTarget = "motorcycles" | "gear";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * Associa (ou remove, com path = null) a foto de uma mota ou item. O ficheiro
 * já foi enviado pelo browser para <user_id>/<target>/<id>-<timestamp>.jpg;
 * a foto antiga é apagada do Storage.
 */
export async function setPhotoAction(target: PhotoTarget, id: string, path: string | null): Promise<ActionResult> {
  return runAction(async ({ supabase, userId }) => {
    if (target !== "motorcycles" && target !== "gear") throw new FormError("Pedido inválido.");
    if (!UUID_RE.test(id)) throw new FormError("Pedido inválido.");
    if (path !== null && !new RegExp(`^${userId}/${target}/${id}-\\d+\\.jpg$`).test(path)) {
      throw new FormError("Caminho de foto inválido.");
    }

    const table = target === "motorcycles" ? "motorcycles" : "gear_items";
    const { data: row, error } = await supabase.from(table).select("photo_path").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new FormError("Não encontrado.");

    check(await supabase.from(table).update({ photo_path: path }).eq("id", id));

    if (row.photo_path && row.photo_path !== path) {
      await supabase.storage.from(PHOTOS_BUCKET).remove([row.photo_path]);
    }
  });
}
