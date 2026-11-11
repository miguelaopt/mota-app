"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card, ListGroup, Section } from "@/components/ui/Card";
import { Field, FormError, TextInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { undoKey } from "@/components/undo/keys";
import { formRunner, useUndo } from "@/components/undo/UndoProvider";
import { deleteBreakAction, deleteShiftAction, updateShiftAction } from "../../actions";

export interface BreakRow {
  id: string;
  label: string;
}

export function ShiftEditor({
  id,
  startedAt,
  endedAt,
  max,
  breaks,
  canDelete,
}: {
  id: string;
  /** Valores para datetime-local (hora de Lisboa). */
  startedAt: string;
  endedAt: string;
  max: string;
  breaks: BreakRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const edit = useFormAction(updateShiftAction, () => setSaved(true));
  const { remove } = useUndo();
  const deleteShift = () => {
    router.push("/trabalho");
    remove({ label: "Turno apagado", keys: [undoKey.shift(id)], run: formRunner(deleteShiftAction, { id }) });
  };

  return (
    <>
      <Section title="Corrigir horário">
        <Card>
          <form {...edit.formProps} onChange={() => setSaved(false)} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <Field label="Entrada" htmlFor="started_at">
              <TextInput id="started_at" name="started_at" type="datetime-local" defaultValue={startedAt} max={max} required />
            </Field>
            <Field label="Saída" htmlFor="ended_at">
              <TextInput id="ended_at" name="ended_at" type="datetime-local" defaultValue={endedAt} max={max} required />
            </Field>
            <FormError error={edit.error} />
            <SubmitButton pending={edit.pending} className="w-full">
              {saved ? (
                <>
                  <CheckIcon size={18} strokeWidth={2.6} /> Guardado
                </>
              ) : (
                "Guardar horário"
              )}
            </SubmitButton>
            <p className="px-1 text-xs text-muted">
              Corrigir muda a estimativa do turno. A poupança já confirmada nas contas não muda; a diferença fica assinalada.
            </p>
          </form>
        </Card>
      </Section>

      {breaks.length > 0 && (
        <Section title="Pausas">
          <ListGroup>
            {breaks.map((b) => (
              <DeleteBreak key={b.id} row={b} />
            ))}
          </ListGroup>
        </Section>
      )}

      {canDelete && (
        <div className="mt-6">
          <Button variant="danger" className="w-full" onClick={deleteShift}>
            Apagar turno
          </Button>
          <p className="mt-2 px-1 text-center text-xs text-faint">Apagar um turno não mexe no saldo das contas.</p>
        </div>
      )}
    </>
  );
}

function DeleteBreak({ row }: { row: BreakRow }) {
  const { pending, formProps } = useFormAction(deleteBreakAction, undefined, { confirmMessage: `Apagar a pausa ${row.label}?` });
  return (
    <form {...formProps} className="flex min-h-12 items-center gap-3 py-2 pl-4 pr-1.5">
      <input type="hidden" name="id" value={row.id} />
      <span className="flex-1 tabular-nums">{row.label}</span>
      <button
        type="submit"
        disabled={pending}
        aria-label={`Apagar pausa ${row.label}`}
        className="flex h-11 w-9 items-center justify-center rounded-full text-faint outline-none active:text-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
      >
        <CloseIcon size={16} />
      </button>
    </form>
  );
}
