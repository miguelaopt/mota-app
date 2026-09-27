import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a sessão do utilizador (cookies), por isso o RLS aplica-se sempre.
 * Criar um por pedido; nunca partilhar entre pedidos.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component, onde não se pode escrever
          // cookies. O proxy.ts já renova a sessão em cada pedido.
        }
      },
    },
  });
}

export type Db = Awaited<ReturnType<typeof createClient>>;
