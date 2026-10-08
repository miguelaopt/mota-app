"use client";

import { useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { ListGroup } from "@/components/ui/Card";
import { Field, FormError, TextInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { deleteScheduledShiftAction, saveScheduledShiftAction } from "./actions";

export interface ScheduledRow {
  id: string;
  /** "Hoje · 18:30–23:30" */
  title: string;
  /** "5h00 pagas · 19,25 € planeados para a mota" */
  detail: string;
  date: string;
  start: string;
  end: string;
  unpaidBreakMinutes: number;
}

type SheetState = { type: "edit"; row: ScheduledRow } | { type: "new" } | null;

export function ScheduledShifts({ rows, today }: { rows: ScheduledRow[]; today: string }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = () => setSheet(null);

  return (
    <>
      <ListGroup>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setSheet({ type: "edit", row })}
            className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-card-2 active:bg-card-2"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium tabular-nums first-letter:uppercase">{row.title}</p>
              <p className="text-sm text-muted tabular-nums">{row.detail}</p>
            </div>
            <ChevronRightIcon size={18} className="shrink-0 text-muted" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSheet({ type: "new" })}
          className="flex w-full items-center gap-2 px-4 py-3.5 font-medium text-accent outline-none focus-visible:bg-card-2 active:bg-card-2"
        >
          <PlusIcon size={20} /> Planear turno
        </button>
      </ListGroup>

      <Sheet open={sheet != null} onClose={close} title={sheet?.type === "edit" ? "Editar turno planeado" : "Planear turno"}>
        {sheet?.type === "edit" && <ScheduleForm row={sheet.row} today={today} onDone={close} />}
        {sheet?.type === "new" && <ScheduleForm today={today} onDone={close} />}
      </Sheet>
    </>
  );
}

function ScheduleForm({ row, today, onDone }: { row?: ScheduledRow; today: string; onDone: () => void }) {
  const { error, pending, formProps } = useFormAction(saveScheduledShiftAction, onDone);

  return (
    <div className="space-y-4">
      <form {...formProps} className="space-y-4">
        {row && <input type="hidden" name="id" value={row.id} />}
        <Field label="Dia" htmlFor="date">
          <TextInput id="date" name="date" type="date" defaultValue={row?.date ?? today} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Entrada" htmlFor="start">
            <TextInput id="start" name="start" type="time" defaultValue={row?.start} required />
          </Field>
          <Field label="Saída" htmlFor="end">
            <TextInput id="end" name="end" type="time" defaultValue={row?.end} required />
          </Field>
        </div>
        <p className="-mt-2 px-1 text-xs text-muted">Se a saída for antes da entrada, conta como no dia seguinte.</p>
        <Field label="Pausa não remunerada prevista (minutos)" htmlFor="unpaid_break_minutes">
          <TextInput
            id="unpaid_break_minutes"
            name="unpaid_break_minutes"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={row?.unpaidBreakMinutes ? String(row.unpaidBreakMinutes) : ""}
            placeholder="0"
          />
        </Field>
        <FormError error={error} />
        <SubmitButton pending={pending} size="lg" className="w-full">
          {row ? "Guardar" : "Planear turno"}
        </SubmitButton>
        <p className="px-1 text-xs text-muted">O horário planeado nunca pica a entrada nem a saída sozinho.</p>
      </form>
      {row && <DeleteScheduled id={row.id} onDone={onDone} />}
    </div>
  );
}

function DeleteScheduled({ id, onDone }: { id: string; onDone: () => void }) {
  const { error, pending, formProps } = useFormAction(deleteScheduledShiftAction, onDone);
  return (
    <form {...formProps}>
      <input type="hidden" name="id" value={id} />
      <FormError error={error} />
      <SubmitButton pending={pending} variant="danger" className="w-full" pendingText="A remover…">
        Remover (folga ou turno cancelado)
      </SubmitButton>
    </form>
  );
}
