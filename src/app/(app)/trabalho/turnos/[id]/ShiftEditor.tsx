"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Card, ListGroup, Section } from "@/components/ui/Card";
import { Field, FormError, TextInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
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
  const remove = useFormAction(deleteShiftAction, () => router.push("/trabalho"), {
    confirmMessage: "Apagar este turno? Esta ação não mexe no saldo das contas.",
  });

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
              {saved ? "Guardado ✓" : "Guardar horário"}
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
        <form {...remove.formProps} className="mt-6">
          <input type="hidden" name="id" value={id} />
          <FormError error={remove.error} />
          <SubmitButton pending={remove.pending} variant="danger" className="w-full" pendingText="A apagar…">
            Apagar turno
          </SubmitButton>
        </form>
      )}
    </>
  );
}

function DeleteBreak({ row }: { row: BreakRow }) {
  const { pending, formProps } = useFormAction(deleteBreakAction, undefined, { confirmMessage: `Apagar a pausa ${row.label}?` });
  return (
    <form {...formProps} className="flex items-center gap-3 py-3 pl-4 pr-2">
      <input type="hidden" name="id" value={row.id} />
      <span className="flex-1 tabular-nums">{row.label}</span>
      <button
        type="submit"
        disabled={pending}
        aria-label={`Apagar pausa ${row.label}`}
        className="rounded-full p-1.5 text-muted outline-none active:bg-card-2 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
      >
        <CloseIcon size={16} />
      </button>
    </form>
  );
}
