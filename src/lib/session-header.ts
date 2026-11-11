/**
 * Sessão validada pelo proxy, passada à página num cabeçalho interno do pedido,
 * para cada pedido só validar a sessão uma vez. O proxy apaga sempre este
 * cabeçalho antes de o escrever, por isso o browser não o consegue forjar.
 */
export const SESSION_HEADER = "x-mota-session";

export interface ProxySession {
  sub: string;
  email: string | null;
}

export function encodeSession(session: ProxySession): string {
  return encodeURIComponent(JSON.stringify(session));
}

export function decodeSession(value: string | null): ProxySession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ProxySession>;
    if (typeof parsed.sub !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.sub)) return null;
    return { sub: parsed.sub, email: typeof parsed.email === "string" ? parsed.email : null };
  } catch {
    return null;
  }
}
