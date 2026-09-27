import "server-only";
import type { BalanceSnapshot } from "@/lib/finance/history";
import { toCents } from "@/lib/finance/money";
import type { Db } from "@/lib/supabase/server";

export interface SnapshotRecord extends BalanceSnapshot {
  id: number;
}

/** Linhas por pedido (o PostgREST do Supabase limita a 1000 por omissão). */
const PAGE_SIZE = 1000;

/** Todo o histórico de saldos, por ordem cronológica. */
export async function getSnapshots(db: Db): Promise<SnapshotRecord[]> {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("balance_snapshots")
      .select("id, account_id, balance, kind, count_pct, safety_margin_pct, recorded_at")
      .order("recorded_at")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    recordedAt: new Date(row.recorded_at),
    balanceCents: toCents(row.balance),
    kind: row.kind,
    countPct: Number(row.count_pct),
    safetyMarginPct: Number(row.safety_margin_pct),
  }));
}
