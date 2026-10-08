"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListGroup } from "@/components/ui/Card";
import { Field, FormError, MoneyInput, Segmented, Select, TextInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { centsToInput, formatEur, parseEur, type Cents } from "@/lib/finance/money";
import { confirmSavingsAction } from "../actions";

export interface PendingShiftRow {
  id: string;
  label: string;
  plannedCents: Cents;
}

export interface AccountOption {
  id: string;
  name: string;
  balanceCents: Cents | null;
  /** Atualizações recentes com aumento ainda por atribuir. */
  increases: Array<{ snapshotId: number; label: string; availableCents: Cents }>;
}

const MODE_OPTIONS = [
  { value: "update", label: "Atualizar saldo agora" },
  { value: "existing", label: "Já atualizei" },
] as const;

export function ConfirmSavingsForm({
  attributionId,
  shifts,
  accounts,
}: {
  attributionId: string;
  shifts: PendingShiftRow[];
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const { error, pending, formProps } = useFormAction(confirmSavingsAction, () => router.push("/trabalho"));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(shifts.map((s) => s.id)));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [mode, setMode] = useState<"update" | "existing">("update");
  const [amount, setAmount] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<string | null>(null);

  const planned = shifts.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.plannedCents, 0);
  const amountText = amount ?? centsToInput(planned);
  const amountCents = parseEur(amountText) ?? 0;
  const account = accounts.find((a) => a.id === accountId);
  const current = account?.balanceCents ?? 0;
  const balanceText = newBalance ?? centsToInput(current + amountCents);
  const balanceCents = parseEur(balanceText);
  const increase = balanceCents == null ? null : balanceCents - current;

  if (accounts.length === 0) {
    return <p className="text-muted">Precisas de pelo menos uma conta ativa para confirmar a poupança.</p>;
  }

  return (
    <form {...formProps} className="space-y-5">
      <input type="hidden" name="attribution_id" value={attributionId} />

      {shifts.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-sm font-medium text-muted">Turnos deste pagamento</p>
          <ListGroup>
            {shifts.map((s) => (
              <label key={s.id} className="flex items-center gap-3 px-4 py-3">
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
                  }}
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                <span className="flex-1 tabular-nums">{s.label}</span>
                <span className="shrink-0 tabular-nums text-muted">{formatEur(s.plannedCents)}</span>
              </label>
            ))}
          </ListGroup>
          <p className="px-1 font-medium tabular-nums">Planeaste guardar {formatEur(planned)} neste período.</p>
        </div>
      )}

      <Field label="Quanto guardaste realmente?" htmlFor="amount" hint="Pode ser diferente do planeado.">
        <MoneyInput id="amount" name="amount" value={amountText} onChange={(event) => setAmount(event.target.value)} className="text-xl font-semibold" />
      </Field>

      <Field label="Em que conta?" htmlFor="account_id">
        <Select id="account_id" name="account_id" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.balanceCents != null ? ` (${formatEur(a.balanceCents)})` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Saldo da conta">
        <Segmented name="mode" options={MODE_OPTIONS} defaultValue="update" onChange={setMode} />
      </Field>

      {mode === "update" ? (
        <Field
          label="Novo saldo da conta"
          htmlFor="new_balance"
          hint={
            increase == null
              ? undefined
              : `Saldo passa de ${formatEur(current)} para ${formatEur(balanceCents!)} (${formatEur(increase, { signed: true })}). ` +
                (increase > amountCents && amountCents > 0
                  ? `${formatEur(amountCents)} ficam identificados como poupança do trabalho; ${formatEur(increase - amountCents)} sem origem atribuída.`
                  : "O dinheiro entra uma única vez.")
          }
        >
          <MoneyInput id="new_balance" name="new_balance" value={balanceText} onChange={(event) => setNewBalance(event.target.value)} />
        </Field>
      ) : account && account.increases.length > 0 ? (
        <Field label="Atualização onde entrou o dinheiro" htmlFor="snapshot_id" hint="A confirmação só classifica esse aumento; o saldo não volta a subir.">
          <Select id="snapshot_id" name="snapshot_id" key={account.id} defaultValue={String(account.increases[0].snapshotId)}>
            {account.increases.map((inc) => (
              <option key={inc.snapshotId} value={inc.snapshotId}>
                {inc.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="rounded-xl bg-card-2 px-3.5 py-3 text-sm text-muted">
          Não há aumentos recentes por atribuir nesta conta. Escolhe outra conta ou atualiza o saldo agora.
        </p>
      )}

      <Field label="Nota (opcional)" htmlFor="notes">
        <TextInput id="notes" name="notes" maxLength={500} placeholder="Ex.: salário de setembro" />
      </Field>

      <FormError error={error} />
      <SubmitButton pending={pending} size="lg" className="w-full" disabled={mode === "existing" && !account?.increases.length}>
        Confirmar poupança
      </SubmitButton>
      <p className="px-1 text-xs text-muted">
        A confirmação não soma dinheiro às contas: identifica que parte de uma atualização de saldo veio do trabalho.
      </p>
    </form>
  );
}
