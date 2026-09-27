function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta a variável de ambiente ${name}. Vê o ficheiro .env.example.`);
  }
  return value;
}

// Acesso literal a process.env.NEXT_PUBLIC_* para o Next os incluir no bundle do cliente.
export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
