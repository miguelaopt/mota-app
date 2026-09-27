/** Resultado devolvido pelas Server Actions dos formulários. */
export type ActionResult = { ok: true } | { ok: false; error: string } | null;

export const ok = (): ActionResult => ({ ok: true });
export const fail = (error: string): ActionResult => ({ ok: false, error });
