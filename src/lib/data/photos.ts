import "server-only";
import type { Db } from "@/lib/supabase/server";

export const PHOTOS_BUCKET = "photos";

/** Validade dos URLs assinados (7 dias). */
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;
/** Um URL em cache é reutilizado enquanto lhe restar pelo menos este tempo. */
const REUSE_MARGIN_MS = 24 * 60 * 60 * 1000;

/**
 * URLs assinados por caminho, guardados na memória do servidor. Reutilizar o
 * mesmo URL deixa o iPhone guardar a imagem em cache (um URL novo em cada
 * visita obrigava a descarregá-la sempre) e poupa uma ida ao Storage.
 * Os caminhos incluem o id do utilizador e o RLS do Storage decide quem os
 * pode assinar.
 */
const cache = new Map<string, { url: string; expiresAt: number }>();

export async function signPhotoUrls(db: Db, paths: Array<string | null | undefined>): Promise<Record<string, string>> {
  const now = Date.now();
  const urls: Record<string, string> = {};
  const missing: string[] = [];
  for (const path of new Set(paths.filter((p): p is string => Boolean(p)))) {
    const hit = cache.get(path);
    if (hit && hit.expiresAt - now > REUSE_MARGIN_MS) urls[path] = hit.url;
    else missing.push(path);
  }
  if (missing.length === 0) return urls;

  const { data, error } = await db.storage.from(PHOTOS_BUCKET).createSignedUrls(missing, SIGNED_URL_SECONDS);
  if (error || !data) {
    console.error("Erro a assinar URLs das fotos", error);
    return urls;
  }
  for (const item of data) {
    if (!item.path || !item.signedUrl) continue;
    urls[item.path] = item.signedUrl;
    cache.set(item.path, { url: item.signedUrl, expiresAt: now + SIGNED_URL_SECONDS * 1000 });
  }
  return urls;
}

/** Esquece um caminho (foto substituída ou apagada). */
export function forgetPhotoUrl(path: string | null | undefined) {
  if (path) cache.delete(path);
}
