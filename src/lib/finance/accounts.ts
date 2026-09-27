import type { Cents } from "./money";

export type AccountKind = "available" | "invested";

export interface AccountValueInput {
  kind: AccountKind;
  /** null = saldo ainda não definido. */
  balanceCents: Cents | null;
  /** 0–100: percentagem do saldo que conta para a mota. */
  countPct: number;
  /** 0–100: só aplicada a contas investidas. */
  safetyMarginPct: number;
}

export interface CountableAccount extends AccountValueInput {
  archived?: boolean;
}

/**
 * Quanto uma conta contribui para a mota:
 * saldo × % da conta × (margem de segurança, se for investida).
 */
export function countedCents(account: AccountValueInput): Cents {
  if (account.balanceCents == null) return 0;
  const margin = account.kind === "invested" ? account.safetyMarginPct / 100 : 1;
  return Math.round(account.balanceCents * (account.countPct / 100) * margin);
}

export interface AccountGroupTotals {
  /** Soma dos saldos (sem percentagens nem margens). */
  balanceCents: Cents;
  /** Soma do que conta para a mota. */
  countedCents: Cents;
  count: number;
}

export interface AccountsSummary {
  available: AccountGroupTotals;
  invested: AccountGroupTotals;
  /** Total que conta para a mota (disponível + investido). */
  totalCountedCents: Cents;
  /** Contas ativas sem saldo definido. */
  missingBalanceCount: number;
}

export function summarizeAccounts(accounts: CountableAccount[]): AccountsSummary {
  const empty = (): AccountGroupTotals => ({ balanceCents: 0, countedCents: 0, count: 0 });
  const summary: AccountsSummary = {
    available: empty(),
    invested: empty(),
    totalCountedCents: 0,
    missingBalanceCount: 0,
  };

  for (const account of accounts) {
    if (account.archived) continue;
    const group = summary[account.kind];
    group.count += 1;
    if (account.balanceCents == null) {
      summary.missingBalanceCount += 1;
      continue;
    }
    const counted = countedCents(account);
    group.balanceCents += account.balanceCents;
    group.countedCents += counted;
    summary.totalCountedCents += counted;
  }

  return summary;
}
