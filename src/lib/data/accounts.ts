import "server-only";
import type { AccountKind, CountableAccount } from "@/lib/finance/accounts";
import { toCents, type Cents } from "@/lib/finance/money";
import type { Db } from "@/lib/supabase/server";

export interface Account extends CountableAccount {
  id: string;
  name: string;
  kind: AccountKind;
  balanceCents: Cents | null;
  balanceUpdatedAt: string | null;
  source: string;
  archived: boolean;
}

export async function getAccounts(db: Db): Promise<Account[]> {
  const { data, error } = await db
    .from("accounts")
    .select("id, name, kind, balance, balance_updated_at, count_pct, safety_margin_pct, source, archived_at")
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    balanceCents: row.balance == null ? null : toCents(row.balance),
    balanceUpdatedAt: row.balance_updated_at,
    countPct: Number(row.count_pct),
    safetyMarginPct: Number(row.safety_margin_pct),
    source: row.source,
    archived: row.archived_at != null,
  }));
}
