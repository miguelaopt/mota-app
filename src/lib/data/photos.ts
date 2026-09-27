import "server-only";
import type { Db } from "@/lib/supabase/server";

export const PHOTOS_BUCKET = "photos";

/** URLs assinados (válidos 1 hora) para as fotos privadas, por caminho. */
export async function signPhotoUrls(db: Db, paths: Array<string | null | undefined>): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return {};

  const { data, error } = await db.storage.from(PHOTOS_BUCKET).createSignedUrls(unique, 60 * 60);
  if (error || !data) {
    console.error("Erro a assinar URLs das fotos", error);
    return {};
  }

  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}
