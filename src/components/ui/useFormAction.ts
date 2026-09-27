"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";

/**
 * useActionState para formulários: chama onSuccess quando a Server Action
 * devolve { ok: true } (por exemplo, para fechar a folha).
 */
export function useFormAction(action: (prev: ActionResult, form: FormData) => Promise<ActionResult>, onSuccess?: () => void) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await action(prev, form);
    if (result?.ok) onSuccess?.();
    return result;
  }, null);

  return { error: state && !state.ok ? state.error : null, formAction, pending };
}
