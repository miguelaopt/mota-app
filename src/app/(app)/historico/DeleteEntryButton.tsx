"use client";

import { CloseIcon } from "@/components/icons";
import { undoKey } from "@/components/undo/keys";
import { formRunner, useUndo } from "@/components/undo/UndoProvider";
import { deleteSnapshotAction } from "./actions";

/** Apaga um registo do histórico, com 5 segundos para "Anular". O saldo atual da conta não muda. */
export function DeleteEntryButton({ id, label }: { id: number; label: string }) {
  const { remove } = useUndo();
  return (
    <button
      type="button"
      onClick={() =>
        remove({
          label: `Registo apagado (${label})`,
          keys: [undoKey.snapshot(id)],
          run: formRunner(deleteSnapshotAction, { id }),
        })
      }
      aria-label={`Apagar registo: ${label}`}
      className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-faint outline-none active:text-fg focus-visible:ring-2 focus-visible:ring-accent"
    >
      <CloseIcon size={16} />
    </button>
  );
}
