export type SupabaseConfig = { ok: true; url: string; key: string } | { ok: false; problems: string[] };

/** Tira espaços e aspas coladas por engano (ex.: "https://…" com aspas na Vercel). */
function clean(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "").trim();
  return cleaned ? cleaned : undefined;
}

/**
 * Lê e valida a configuração do Supabase. Devolve os problemas em português
 * em vez de rebentar, para o proxy poder mostrar uma página útil.
 */
export function getSupabaseConfig(): SupabaseConfig {
  // Acesso literal a process.env.NEXT_PUBLIC_* para o Next os incluir no bundle do cliente.
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const problems: string[] = [];

  if (!url) {
    problems.push("Falta a variável NEXT_PUBLIC_SUPABASE_URL.");
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
      problems.push("NEXT_PUBLIC_SUPABASE_URL não é um URL válido: tem de começar por https:// (ex.: https://abcdefgh.supabase.co).");
    } else if (parsed.pathname !== "/" || parsed.search) {
      problems.push(
        "NEXT_PUBLIC_SUPABASE_URL deve ser só o endereço do projeto (ex.: https://abcdefgh.supabase.co), sem /rest/v1 nem outros caminhos.",
      );
    }
  }

  if (!key) {
    problems.push("Falta a variável NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, url: url!.replace(/\/+$/, ""), key: key! };
}

function requireConfig() {
  const config = getSupabaseConfig();
  if (!config.ok) throw new Error(`Configuração do Supabase inválida: ${config.problems.join(" ")}`);
  return config;
}

export function supabaseUrl(): string {
  return requireConfig().url;
}

export function supabasePublishableKey(): string {
  return requireConfig().key;
}
