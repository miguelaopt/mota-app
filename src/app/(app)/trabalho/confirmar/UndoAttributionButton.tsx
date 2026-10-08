"use client";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { deleteAttributionAction } from "../actions";

export function UndoAttributionButton({ id }: { id: string }) {
  const { pending, formProps } = useFormAction(deleteAttributionAction, undefined, {
    confirmMessage: "Anular esta confirmação? O saldo da conta não muda; os turnos voltam a ficar por confirmar.",
  });
  return (
    <form {...formProps}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton pending={pending} variant="ghost" size="sm" pendingText="…">
        Anular
      </SubmitButton>
    </form>
  );
}
