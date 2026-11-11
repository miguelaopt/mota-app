"use client";

import { startTransition, useOptimistic, useState, type FormEvent } from "react";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { Badge, Notice } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, ListGroup, Section } from "@/components/ui/Card";
import { Field, FormError, MoneyInput, PercentInput, Segmented, TextInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { undoKey } from "@/components/undo/keys";
import { formRunner, useUndo } from "@/components/undo/UndoProvider";
import { countedCents, summarizeAccounts, type AccountKind } from "@/lib/finance/accounts";
import { formatEur, parseEur, type Cents } from "@/lib/finance/money";
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

type SheetState =
  | { type: "balance"; account: AccountRow; error?: string; draft?: string }
  | { type: "edit"; account: AccountRow }
  | { type: "new" }
  | null;

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
  const { hidden, remove } = useUndo();
  // O novo saldo aparece logo; se o servidor recusar, volta atrás e reabre a folha com o erro.
  const [optimistic, applyBalance] = useOptimistic(accounts, (list, update: { id: string; cents: Cents }) =>
    list.map((a) =>
      a.id === update.id
        ? { ...a, balanceCents: update.cents, countedCents: countedCents({ ...a, balanceCents: update.cents }), updatedLabel: "a guardar…" }
        : a,
    ),
  );
  const close = () => setSheet(null);
  const visible = optimistic.filter((a) => !hidden.has(undoKey.account(a.id)));
  const active = visible.filter((a) => !a.archived);
  const archived = visible.filter((a) => a.archived);
  const summary = summarizeAccounts(active);
  const investedDiffers = summary.invested.balanceCents !== summary.invested.countedCents;
  const availableDiffers = summary.available.balanceCents !== summary.available.countedCents;

  const saveBalance = (account: AccountRow, form: FormData, cents: Cents) => {
    setSheet(null);
    startTransition(async () => {
      applyBalance({ id: account.id, cents });
      const result = await updateBalanceAction(null, form);
      if (!result?.ok) {
        startTransition(() =>
          setSheet({
            type: "balance",
            account,
            error: result?.error ?? "Não foi possível guardar.",
            draft: String(form.get("balance") ?? ""),
          }),
        );
      }
    });
  };

  const archive = (account: AccountRow) => {
    setSheet(null);
    remove({
      label: `Conta "${account.name}" removida`,
      keys: [undoKey.account(account.id)],
      run: formRunner(archiveAccountAction, { id: account.id }),
    });
  };

  return (
    <>
      <Card className="p-[1.125rem]">
        <p className="eyebrow">Conta para a mota</p>
        <p className="display mt-1 text-[clamp(2.25rem,12.5vw,3.125rem)] leading-[0.95]">{formatEur(summary.totalCountedCents)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
            <p className="eyebrow tracking-[0.12em]">Disponível</p>
            <p className="display mt-1.5 text-[1.625rem]">{formatEur(summary.available.countedCents)}</p>
            {availableDiffers && <p className="mt-1 text-xs text-faint tabular-nums">saldo {formatEur(summary.available.balanceCents)}</p>}
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
            <p className="eyebrow tracking-[0.12em]">Investido</p>
            <p className="display mt-1.5 text-[1.625rem]">{formatEur(summary.invested.countedCents)}</p>
            {investedDiffers && (
              <p className="mt-1 text-xs text-faint tabular-nums">valor {formatEur(summary.invested.balanceCents)} com margem</p>
            )}
          </div>
        </div>
      </Card>

      {summary.missingBalanceCount > 0 && (
        <Notice className="mt-3">
          {summary.missingBalanceCount === 1
            ? "Há 1 conta sem saldo definido."
            : `Há ${summary.missingBalanceCount} contas sem saldo definido.`}{" "}
          Toca numa conta para o definir.
        </Notice>
      )}

      <Section title="As tuas contas">
        <ListGroup>
          {active.map((account) => {
            const rule = countsLabel(account);
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setSheet({ type: "balance", account })}
                className="flex min-h-16 w-full items-center gap-3 py-3 pl-4 pr-3.5 text-left outline-none focus-visible:bg-card-2 active:bg-card-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-semibold">{account.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {ACCOUNT_KIND_LABEL[account.kind]}
                    {rule && ` · ${rule}`}
                    {account.balanceCents == null
                      ? " · toca para definir o saldo"
                      : account.updatedLabel
                        ? ` · ${account.updatedLabel}`
                        : ""}
                  </p>
                </div>
                <div className="text-right">
                  {account.balanceCents == null ? (
                    <Badge tone="warning">Sem saldo</Badge>
                  ) : (
                    <>
                      <p className="display text-[1.375rem] leading-[1.1]">{formatEur(account.balanceCents)}</p>
                      {account.countedCents !== account.balanceCents && (
                        <p className="text-[0.6875rem] text-accent tabular-nums">conta {formatEur(account.countedCents)}</p>
                      )}
                    </>
                  )}
                </div>
                <ChevronRightIcon size={16} className="shrink-0 text-faint" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSheet({ type: "new" })}
            className="flex min-h-14 w-full items-center gap-2 px-4 py-3.5 text-[0.9375rem] font-semibold text-accent outline-none focus-visible:bg-card-2 active:bg-card-2"
          >
            <PlusIcon size={18} /> Adicionar conta
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
          <BalanceForm
            account={sheet.account}
            error={sheet.error}
            draft={sheet.draft}
            onSave={(form, cents) => saveBalance(sheet.account, form, cents)}
            onEdit={() => setSheet({ type: "edit", account: sheet.account })}
          />
        )}
      </Sheet>

      <Sheet
        open={sheet?.type === "edit" || sheet?.type === "new"}
        onClose={close}
        title={sheet?.type === "edit" ? "Editar conta" : "Nova conta"}
      >
        {sheet?.type === "edit" && <AccountForm account={sheet.account} onDone={close} onArchive={() => archive(sheet.account)} />}
        {sheet?.type === "new" && <AccountForm onDone={close} />}
      </Sheet>
    </>
  );
}

function BalanceForm({
  account,
  error: serverError,
  draft,
  onSave,
  onEdit,
}: {
  account: AccountRow;
  error?: string;
  draft?: string;
  onSave: (form: FormData, cents: Cents) => void;
  onEdit: () => void;
}) {
  const [error, setError] = useState<string | null>(serverError ?? null);
  const rule = countsLabel(account);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cents = parseEur(String(form.get("balance") ?? ""));
    if (cents == null) {
      setError("Indica o saldo (ex.: 1.234,56).");
      return;
    }
    onSave(form, cents);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
        <MoneyInput
          id="balance"
          name="balance"
          defaultCents={account.balanceCents}
          defaultText={draft}
          autoFocus
          className="display h-16 text-[2rem]"
        />
      </Field>
      {rule && <p className="px-1 text-sm text-muted">Para a mota conta: {rule}.</p>}
      <FormError error={error} />
      <SubmitButton pending={false} size="lg" className="w-full">
        Guardar saldo
      </SubmitButton>
      <Button variant="ghost" className="w-full" onClick={onEdit}>
        Editar conta
      </Button>
    </form>
  );
}

function AccountForm({ account, onDone, onArchive }: { account?: AccountRow; onDone: () => void; onArchive?: () => void }) {
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
      {onArchive && (
        <Button variant="danger" className="w-full" onClick={onArchive}>
          Remover conta
        </Button>
      )}
    </div>
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
