import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { decodeSession, SESSION_HEADER } from "@/lib/session-header";
import { createClient } from "@/lib/supabase/server";

/**
 * Sessão atual, memorizada por pedido. Normalmente já vem validada pelo proxy
 * (cabeçalho interno); só sem ele pergunta ao Supabase.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const fromProxy = decodeSession((await headers()).get(SESSION_HEADER));
  if (fromProxy) return { supabase, userId: fromProxy.sub, email: fromProxy.email };

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

/** Para páginas e Server Actions protegidas: devolve a sessão ou vai para /login. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** ALLOWED_EMAIL aceita um ou vários emails separados por vírgulas. */
export function isAllowedEmail(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
