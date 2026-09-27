"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-result";

/**
 * useActionState para formulários: chama onSuccess quando a Server Action
 * devolve { ok: true } (por exemplo, para fechar a folha).
 *
 * A action é despachada no onSubmit em vez de <form action>, porque o React
 * limpa o formulário depois de uma action e perdiam-se os valores escritos
 * quando há um erro de validação.
 */
export function useFormAction(
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>,
  onSuccess?: () => void,
  { confirmMessage }: { confirmMessage?: string } = {},
) {
  const [state, dispatch, pending] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await action(prev, form);
    if (result?.ok) onSuccess?.();
    return result;
  }, null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(form));
  };

  return { error: state && !state.ok ? state.error : null, pending, formProps: { onSubmit } };
}
