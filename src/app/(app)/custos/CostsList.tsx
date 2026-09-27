"use client";

import { useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { ListGroup } from "@/components/ui/Card";
import { Field, FormError, MoneyInput, Segmented, TextArea, TextInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import type { CostKind, ItemPriority } from "@/lib/finance/goal";
import { formatEur, type Cents } from "@/lib/finance/money";
import { PRIORITY_LABEL } from "@/lib/labels";
import { deleteCostAction, saveCostAction } from "./actions";

export interface CostRow {
  id: string;
  name: string;
  amountCents: Cents;
  priority: ItemPriority;
  notes: string | null;
}

const PRIORITY_OPTIONS = [
  { value: "essential", label: "Essencial" },
  { value: "later", label: "Pode esperar" },
] as const;

export function CostsList({ kind, costs }: { kind: CostKind; costs: CostRow[] }) {
  const [editing, setEditing] = useState<CostRow | "new" | null>(null);
  const close = () => setEditing(null);
  const monthly = kind === "monthly";

  return (
    <>
      <ListGroup>
        {costs.map((cost) => (
          <button
            key={cost.id}
            type="button"
            onClick={() => setEditing(cost)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:bg-card-2 active:bg-card-2"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{cost.name}</p>
              {!monthly && cost.priority === "later" && (
                <p className="mt-0.5">
                  <Badge>{PRIORITY_LABEL.later}</Badge>
                </p>
              )}
              {cost.notes && <p className="mt-0.5 truncate text-sm text-muted">{cost.notes}</p>}
            </div>
            {cost.amountCents > 0 ? (
              <span className="font-semibold tabular-nums">
                {formatEur(cost.amountCents)}
                {monthly && <span className="text-sm font-normal text-muted">/mês</span>}
              </span>
            ) : (
              <Badge tone="warning">Sem valor</Badge>
            )}
            <ChevronRightIcon size={18} className="shrink-0 text-muted" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex w-full items-center gap-2 px-4 py-3.5 font-medium text-accent outline-none focus-visible:bg-card-2 active:bg-card-2"
        >
          <PlusIcon size={20} /> {monthly ? "Adicionar custo mensal" : "Adicionar custo"}
        </button>
      </ListGroup>

      <Sheet
        open={editing !== null}
        onClose={close}
        title={editing === "new" ? (monthly ? "Novo custo mensal" : "Novo custo da compra") : "Editar custo"}
      >
        {editing && <CostForm kind={kind} cost={editing === "new" ? undefined : editing} onDone={close} />}
      </Sheet>
    </>
  );
}

function CostForm({ kind, cost, onDone }: { kind: CostKind; cost?: CostRow; onDone: () => void }) {
  const { error, pending, formProps } = useFormAction(saveCostAction, onDone);
  const monthly = kind === "monthly";

  return (
    <div className="space-y-4">
      <form {...formProps} className="space-y-4">
        {cost && <input type="hidden" name="id" value={cost.id} />}
        <input type="hidden" name="kind" value={kind} />
        <Field label="Nome" htmlFor="name">
          <TextInput
            id="name"
            name="name"
            defaultValue={cost?.name}
            placeholder={monthly ? "Ex.: Via Verde" : "Ex.: Matrícula nova"}
            maxLength={100}
            required
          />
        </Field>
        <Field label={monthly ? "Valor por mês" : "Valor"} htmlFor="amount" hint={monthly ? "Para custos anuais, divide por 12." : undefined}>
          <MoneyInput id="amount" name="amount" defaultCents={cost?.amountCents || null} />
        </Field>
        {!monthly && (
          <Field label="Prioridade" hint="Os essenciais entram no mínimo para começar a andar.">
            <Segmented name="priority" options={PRIORITY_OPTIONS} defaultValue={cost?.priority ?? "essential"} />
          </Field>
        )}
        <Field label="Notas" htmlFor="notes">
          <TextArea id="notes" name="notes" defaultValue={cost?.notes ?? ""} placeholder="Simulações, orçamentos…" maxLength={1000} />
        </Field>
        <FormError error={error} />
        <SubmitButton pending={pending} size="lg" className="w-full">
          {cost ? "Guardar" : "Adicionar"}
        </SubmitButton>
      </form>
      {cost && <DeleteCostButton id={cost.id} onDone={onDone} />}
    </div>
  );
}

function DeleteCostButton({ id, onDone }: { id: string; onDone: () => void }) {
  const { error, pending, formProps } = useFormAction(deleteCostAction, onDone, { confirmMessage: "Apagar este custo?" });
  return (
    <form {...formProps}>
      <input type="hidden" name="id" value={id} />
      <FormError error={error} />
      <SubmitButton pending={pending} variant="danger" className="w-full" pendingText="A apagar…">
        Apagar custo
      </SubmitButton>
    </form>
  );
}
