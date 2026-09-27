import type { Metadata } from "next";
import { Notice } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { getAccounts } from "@/lib/data/accounts";
import { formatRelative } from "@/lib/dates";
import { countedCents, summarizeAccounts } from "@/lib/finance/accounts";
import { formatEur } from "@/lib/finance/money";
import { AccountsList, type AccountRow } from "./AccountsList";

export const metadata: Metadata = { title: "Contas" };

export default async function AccountsPage() {
  const { supabase } = await requireSession();
  const accounts = await getAccounts(supabase);
  const summary = summarizeAccounts(accounts);
  const now = new Date();

  const rows: AccountRow[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    kind: account.kind,
    balanceCents: account.balanceCents,
    countedCents: countedCents(account),
    countPct: account.countPct,
    safetyMarginPct: account.safetyMarginPct,
    archived: account.archived,
    updatedLabel: account.balanceUpdatedAt ? `atualizado ${formatRelative(account.balanceUpdatedAt, now)}` : null,
  }));

  const investedDiffers = summary.invested.balanceCents !== summary.invested.countedCents;
  const availableDiffers = summary.available.balanceCents !== summary.available.countedCents;

  return (
    <>
      <PageHeader title="Contas" />

      <Card>
        <p className="text-sm text-muted">Conta para a mota</p>
        <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums">{formatEur(summary.totalCountedCents)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-card-2 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Disponível</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatEur(summary.available.countedCents)}</p>
            {availableDiffers && (
              <p className="text-xs text-muted tabular-nums">saldo {formatEur(summary.available.balanceCents)}</p>
            )}
          </div>
          <div className="rounded-xl bg-card-2 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Investido</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatEur(summary.invested.countedCents)}</p>
            {investedDiffers && (
              <p className="text-xs text-muted tabular-nums">valor {formatEur(summary.invested.balanceCents)}</p>
            )}
          </div>
        </div>
      </Card>

      {summary.missingBalanceCount > 0 && (
        <Notice className="mt-4">
          {summary.missingBalanceCount === 1
            ? "Há 1 conta sem saldo definido."
            : `Há ${summary.missingBalanceCount} contas sem saldo definido.`}{" "}
          Toca numa conta para o definir.
        </Notice>
      )}

      <AccountsList accounts={rows} />

      <p className="mt-4 px-1 text-xs text-muted">
        Cada atualização de saldo fica guardada no histórico e é usada para calcular o teu ritmo de poupança.
      </p>
    </>
  );
}
