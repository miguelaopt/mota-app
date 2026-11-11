"use client";

import { useState } from "react";
import { confirmSavingsAction } from "@/app/(app)/trabalho/actions";
import { ChevronRightIcon } from "@/components/icons";
import { Field, FormError, MoneyInput, Select, TextInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { cn } from "@/lib/cn";
import { formatShortDate, formatTime } from "@/lib/dates";
import { centsToInput, formatEur, parseEur } from "@/lib/finance/money";
import type { ConfirmData } from "@/lib/work/confirm";
import { formatHm } from "@/lib/work/format";

/**
 * "Recebi o pagamento": regista quanto do dinheiro do trabalho entrou numa
 * conta. Pergunta se o saldo já foi atualizado, para o dinheiro nunca entrar
 * duas vezes: "Sim" liga a um aumento já registado; "Não" atualiza o saldo agora.
 */
export function ReceivePaymentForm({
  data,
  attributionId,
  renderedAt,
  redirectTo,
  onDone,
}: {
  data: ConfirmData;
  attributionId: string;
  renderedAt: number;
  /** Página para onde ir depois de confirmar (na mesma resposta do servidor). */
  redirectTo?: "/trabalho";
  onDone?: () => void;
}) {
  const now = new Date(renderedAt);
  const { error, pending, formProps } = useFormAction(confirmSavingsAction, onDone);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(data.pending.map((s) => s.id)));
  const [showShifts, setShowShifts] = useState(false);
  const [accountId, setAccountId] = useState(data.suggestedAccountId ?? data.accounts[0]?.id ?? "");
  const [already, setAlready] = useState(data.suggestedAlreadyUpdated);
  const [amount, setAmount] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<string | null>(null);

  const chosen = data.pending.filter((s) => selected.has(s.id));
  const planned = chosen.reduce((sum, s) => sum + s.plannedCents, 0);
  const amountText = amount ?? centsToInput(planned);
  const amountCents = parseEur(amountText) ?? 0;
  const account = data.accounts.find((a) => a.id === accountId);
  const current = account?.balanceCents ?? 0;
  const balanceText = newBalance ?? centsToInput(current + amountCents);
  const balanceCents = parseEur(balanceText);
  const increases = account?.increases ?? [];
  const covering = increases.find((inc) => inc.availableCents >= amountCents) ?? increases[0];
  const paidMs = chosen.reduce((sum, s) => sum + s.paidMs, 0);

  if (data.accounts.length === 0) {
    return <p className="text-muted">Precisas de pelo menos uma conta ativa para registar a poupança.</p>;
  }

  const range =
    chosen.length === 0
      ? "nenhum turno escolhido"
      : `${formatShortDate(new Date(chosen[0].startedAt), now)}${chosen.length > 1 ? ` – ${formatShortDate(new Date(chosen[chosen.length - 1].startedAt), now)}` : ""} · ${formatHm(paidMs)} pagas`;

  return (
    <form {...formProps} className="space-y-5">
      <input type="hidden" name="attribution_id" value={attributionId} />
      {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
      <input type="hidden" name="mode" value={already ? "existing" : "update"} />

      {data.pending.length > 0 && (
        <div className="rounded-[18px] border border-glass-border bg-card-2">
          <button
            type="button"
            onClick={() => setShowShifts(!showShifts)}
            aria-expanded={showShifts}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {chosen.length} {chosen.length === 1 ? "turno feito" : "turnos feitos"}
              </span>
              <span className="block text-xs text-muted tabular-nums">{range}</span>
            </span>
            <span className="display text-[1.375rem] text-accent">{formatEur(planned)}</span>
            <ChevronRightIcon size={18} className={cn("shrink-0 text-faint transition-transform", showShifts && "rotate-90")} />
          </button>
          {showShifts && (
            <div className="divide-y divide-sep border-t border-sep">
              {data.pending.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    name="shift_ids"
                    value={s.id}
                    checked={selected.has(s.id)}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      setSelected(next);
                      setAmount(null);
                    }}
                    className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="flex-1 text-sm tabular-nums">
                    {formatShortDate(new Date(s.startedAt), now)}, {formatTime(s.startedAt)} · {formatHm(s.paidMs)}
                  </span>
                  <span className="text-sm text-muted tabular-nums">{formatEur(s.plannedCents)}</span>
                </label>
              ))}
            </div>
          )}
          {/* Turnos escolhidos vão no formulário mesmo com a lista fechada. */}
          {!showShifts && chosen.map((s) => <input key={s.id} type="hidden" name="shift_ids" value={s.id} />)}
        </div>
      )}

      <Field label="Quanto guardaste?" htmlFor="amount" hint="Pode ser diferente do planeado.">
        <MoneyInput
          id="amount"
          name="amount"
          value={amountText}
          onChange={(event) => setAmount(event.target.value)}
          className="display h-14 text-[1.75rem]"
        />
      </Field>

      <Field label="Em que conta entrou?" htmlFor="account_id">
        <Select
          id="account_id"
          name="account_id"
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value);
            setNewBalance(null);
          }}
        >
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.balanceCents != null ? ` · ${formatEur(a.balanceCents)}` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 px-1 text-sm font-medium text-muted">O dinheiro já está no saldo de {account?.name ?? "esta conta"}?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-glass-border bg-card-2 p-1" role="radiogroup">
          {[
            { value: true, label: "Sim, já atualizei" },
            { value: false, label: "Não, atualiza agora" },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={already === option.value}
              onClick={() => setAlready(option.value)}
              className={cn(
                "min-h-11 rounded-[10px] px-2 text-sm transition-colors",
                already === option.value ? "bg-accent font-semibold text-accent-fg" : "font-medium text-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {already ? (
          increases.length > 0 ? (
            <Field label="Atualização onde entrou" htmlFor="snapshot_id">
              <Select id="snapshot_id" name="snapshot_id" key={`${account?.id}-${covering?.snapshotId}`} defaultValue={String(covering?.snapshotId)}>
                {increases.map((inc) => (
                  <option key={inc.snapshotId} value={inc.snapshotId}>
                    {formatShortDate(new Date(inc.recordedAt), now)}, {formatTime(inc.recordedAt)} · {formatEur(inc.increaseCents, { signed: true })}
                    {inc.availableCents < inc.increaseCents ? ` (${formatEur(inc.availableCents)} livres)` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="rounded-[14px] border border-glass-border bg-card-2 px-3.5 py-3 text-sm text-muted">
              Não há aumentos recentes de saldo nesta conta. Escolhe outra conta ou &quot;Não, atualiza agora&quot;.
            </p>
          )
        ) : (
          <>
            <Field label="Novo saldo da conta" htmlFor="new_balance">
              <MoneyInput id="new_balance" name="new_balance" value={balanceText} onChange={(event) => setNewBalance(event.target.value)} />
            </Field>
            {balanceCents != null && (
              <p className="px-1 text-sm text-muted tabular-nums">
                {account?.name} passa de {formatEur(current)} para <span className="font-semibold text-fg">{formatEur(balanceCents)}</span>.
              </p>
            )}
          </>
        )}
      </fieldset>

      <Field label="Nota (opcional)" htmlFor="notes">
        <TextInput id="notes" name="notes" maxLength={500} placeholder="Ex.: salário de novembro" />
      </Field>

      <FormError error={error} />
      <SubmitButton pending={pending} size="lg" className="w-full" disabled={amountCents <= 0 || (already && increases.length === 0)}>
        Confirmar {formatEur(amountCents)}
      </SubmitButton>
      <p className="-mt-2 px-1 text-center text-xs text-faint">O dinheiro entra uma só vez nas contas.</p>
    </form>
  );
}
