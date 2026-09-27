"use client";

import { CloseIcon } from "@/components/icons";
import { useFormAction } from "@/components/ui/useFormAction";
import { deleteSnapshotAction } from "./actions";

export function DeleteEntryButton({ id, label }: { id: number; label: string }) {
  const { pending, formProps } = useFormAction(deleteSnapshotAction, undefined, {
    confirmMessage: `Apagar este registo do histórico (${label})? O saldo atual da conta não muda.`,
  });

  return (
    <form {...formProps}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Apagar registo: ${label}`}
        className="rounded-full p-1.5 text-muted outline-none active:bg-card-2 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
      >
        <CloseIcon size={16} />
      </button>
    </form>
  );
}
