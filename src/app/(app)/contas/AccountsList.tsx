"use client";

import { useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ListGroup, Section } from "@/components/ui/Card";
import { Field, FormError, MoneyInput, PercentInput, Segmented, TextInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import type { AccountKind } from "@/lib/finance/accounts";
import { formatEur, type Cents } from "@/lib/finance/money";
import { ACCOUNT_KIND_LABEL } from "@/lib/labels";
import { archiveAccountAction, restoreAccountAction, saveAccountAction, updateBalanceAction } from "./actions";

export interface AccountRow {
  id: string;
  name: string;
  kind: AccountKind;
  balanceCents: Cents | null;
  countedCents: Cents;
  countPct: number;
  safetyMarginPct: number;
  archived: boolean;
  /** Ex.: "atualizado há 3 dias" (calculado no servidor). */
  updatedLabel: string | null;
}

type SheetState = { type: "balance"; account: AccountRow } | { type: "edit"; account: AccountRow } | { type: "new" } | null;

const KIND_OPTIONS = [
  { value: "available", label: "Disponível" },
  { value: "invested", label: "Investido" },
] as const;

function countsLabel(account: AccountRow): string | null {
  const parts: string[] = [];
  if (account.countPct !== 100) parts.push(`${String(account.countPct).replace(".", ",")}% do saldo`);
  if (account.kind === "invested" && account.safetyMarginPct !== 100) {
    parts.push(`margem ${String(account.safetyMarginPct).replace(".", ",")}%`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function AccountsList({ accounts }: { accounts: AccountRow[] }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = () => setSheet(null);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <>
      <Section title="As tuas contas">
        <ListGroup>
          {active.map((account) => {
            const rule = countsLabel(account);
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setSheet({ type: "balance", account })}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:bg-card-2 active:bg-card-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{account.name}</span>
                    <Badge tone={account.kind === "invested" ? "accent" : "neutral"}>{ACCOUNT_KIND_LABEL[account.kind]}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {account.balanceCents == null ? "Toca para definir o saldo" : (account.updatedLabel ?? "")}
                    {rule && ` · ${rule}`}
                  </p>
                </div>
                <div className="text-right">
                  {account.balanceCents == null ? (
                    <Badge tone="warning">Sem saldo</Badge>
                  ) : (
                    <>
                      <p className="font-semibold tabular-nums">{formatEur(account.balanceCents)}</p>
                      {account.countedCents !== account.balanceCents && (
                        <p className="text-xs text-muted tabular-nums">conta {formatEur(account.countedCents)}</p>
                      )}
                    </>
                  )}
                </div>
                <ChevronRightIcon size={18} className="shrink-0 text-muted" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSheet({ type: "new" })}
            className="flex w-full items-center gap-2 px-4 py-3.5 font-medium text-accent outline-none focus-visible:bg-card-2 active:bg-card-2"
          >
            <PlusIcon size={20} /> Adicionar conta
          </button>
        </ListGroup>
      </Section>

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer px-1 text-sm text-muted">Contas arquivadas ({archived.length})</summary>
          <ListGroup className="mt-2">
            {archived.map((account) => (
              <div key={account.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-muted">{account.name}</span>
                <RestoreButton id={account.id} />
              </div>
            ))}
          </ListGroup>
        </details>
      )}

      <Sheet open={sheet?.type === "balance"} onClose={close} title={sheet?.type === "balance" ? sheet.account.name : ""}>
        {sheet?.type === "balance" && (
          <BalanceForm account={sheet.account} onDone={close} onEdit={() => setSheet({ type: "edit", account: sheet.account })} />
        )}
      </Sheet>

      <Sheet open={sheet?.type === "edit" || sheet?.type === "new"} onClose={close} title={sheet?.type === "edit" ? "Editar conta" : "Nova conta"}>
        {sheet?.type === "edit" && <AccountForm account={sheet.account} onDone={close} />}
        {sheet?.type === "new" && <AccountForm onDone={close} />}
      </Sheet>
    </>
  );
}

function BalanceForm({ account, onDone, onEdit }: { account: AccountRow; onDone: () => void; onEdit: () => void }) {
  const { error, pending, formProps } = useFormAction(updateBalanceAction, onDone);
  const rule = countsLabel(account);

  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="id" value={account.id} />
      <Field
        label="Saldo atual"
        htmlFor="balance"
        hint={
          account.balanceCents == null
            ? "Primeiro registo desta conta: serve de ponto de partida para o ritmo de poupança."
            : `Antes: ${formatEur(account.balanceCents)}${account.updatedLabel ? ` (${account.updatedLabel})` : ""}`
        }
      >
        <MoneyInput id="balance" name="balance" defaultCents={account.balanceCents} autoFocus className="py-4 text-2xl font-semibold" />
      </Field>
      {rule && <p className="px-1 text-sm text-muted">Para a mota conta: {rule}.</p>}
      <FormError error={error} />
      <SubmitButton pending={pending} size="lg" className="w-full">
        Guardar saldo
      </SubmitButton>
      <Button variant="ghost" className="w-full" onClick={onEdit}>
        Editar conta
      </Button>
    </form>
  );
}

function AccountForm({ account, onDone }: { account?: AccountRow; onDone: () => void }) {
  const { error, pending, formProps } = useFormAction(saveAccountAction, onDone);
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "available");

  return (
    <div className="space-y-4">
      <form {...formProps} className="space-y-4">
        {account && <input type="hidden" name="id" value={account.id} />}
        <Field label="Nome" htmlFor="name">
          <TextInput id="name" name="name" defaultValue={account?.name} placeholder="Ex.: Conta poupança" maxLength={60} required />
        </Field>
        <Field label="Tipo">
          <Segmented name="kind" options={KIND_OPTIONS} defaultValue={kind} onChange={setKind} />
        </Field>
        {!account && (
          <Field label="Saldo atual" htmlFor="balance" hint="Podes deixar em branco e definir depois.">
            <MoneyInput id="balance" name="balance" />
          </Field>
        )}
        <Field label="Percentagem do saldo que conta para a mota" htmlFor="count_pct">
          <PercentInput id="count_pct" name="count_pct" defaultPct={account?.countPct ?? 100} />
        </Field>
        {kind === "invested" && (
          <Field
            label="Margem de segurança"
            htmlFor="safety_margin_pct"
            hint="Os investimentos podem desvalorizar: conta só esta percentagem do valor (ex.: 80%)."
          >
            <PercentInput id="safety_margin_pct" name="safety_margin_pct" defaultPct={account?.safetyMarginPct ?? 80} />
          </Field>
        )}
        <FormError error={error} />
        <SubmitButton pending={pending} size="lg" className="w-full">
          {account ? "Guardar alterações" : "Adicionar conta"}
        </SubmitButton>
      </form>
      {account && <ArchiveButton id={account.id} onDone={onDone} />}
    </div>
  );
}

function ArchiveButton({ id, onDone }: { id: string; onDone: () => void }) {
  const { error, pending, formProps } = useFormAction(archiveAccountAction, onDone, {
    confirmMessage: "Remover esta conta? Deixa de contar para a mota, mas o histórico mantém-se.",
  });
  return (
    <form {...formProps}>
      <input type="hidden" name="id" value={id} />
      <FormError error={error} />
      <SubmitButton pending={pending} variant="danger" className="w-full" pendingText="A remover…">
        Remover conta
      </SubmitButton>
    </form>
  );
}

function RestoreButton({ id }: { id: string }) {
  const { pending, formProps } = useFormAction(restoreAccountAction);
  return (
    <form {...formProps}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton pending={pending} variant="ghost" size="sm" pendingText="…">
        Restaurar
      </SubmitButton>
    </form>
  );
}
