import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { fail, ok, type ActionResult } from "./action-result";
import { requireSession } from "./auth";
import { FormError } from "./forms";

type Session = Awaited<ReturnType<typeof requireSession>>;

/**
 * Corre uma alteração com a sessão do utilizador (RLS aplica-se), converte
 * erros de validação em mensagens e atualiza todos os ecrãs, já que qualquer
 * alteração pode mexer nos totais do Início.
 */
export async function runAction(fn: (session: Session) => Promise<void>): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await fn(session);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof FormError) return fail(error.message);
    console.error(error);
    return fail("Não foi possível guardar. Verifica a ligação e tenta outra vez.");
  }
  revalidatePath("/", "layout");
  return ok();
}

/** Lança o erro do Supabase, se houver, para o runAction tratar. */
export function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}
