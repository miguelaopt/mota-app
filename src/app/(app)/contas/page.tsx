import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { getAccounts } from "@/lib/data/accounts";
import { formatRelative } from "@/lib/dates";
import { countedCents } from "@/lib/finance/accounts";
import { AccountsList, type AccountRow } from "./AccountsList";

export const metadata: Metadata = { title: "Contas" };

export default async function AccountsPage() {
  const { supabase } = await requireSession();
  const accounts = await getAccounts(supabase);
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

  return (
    <>
      <PageHeader title="Contas" />

      <AccountsList accounts={rows} />

      <p className="mt-4 px-1 text-xs text-faint">
        Cada atualização de saldo fica guardada no histórico e é usada para calcular o teu ritmo de poupança.
      </p>
    </>
  );
}
