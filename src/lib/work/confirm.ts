import { DAY_MS } from "@/lib/finance/history";
import type { Cents } from "@/lib/finance/money";
import { estimateShift, type ShiftTerms, type ShiftTiming } from "./shift";

/**
 * Dados para "Recebi o pagamento": turnos por confirmar, aumentos de saldo
 * recentes ainda por atribuir e uma sugestão de conta e de modo que evita
 * contar o mesmo dinheiro duas vezes.
 */

export interface ConfirmShift extends ShiftTiming, ShiftTerms {
  id: string;
  attributionId: string | null;
}

export interface ConfirmAccountInput {
  id: string;
  name: string;
  balanceCents: Cents | null;
  balanceUpdatedAt: string | null;
  archived: boolean;
}

export interface ConfirmSnapshotInput {
  id: number;
  accountId: string;
  recordedAt: Date;
  balanceCents: Cents;
}

export interface ConfirmAttributionInput {
  snapshotId: number | null;
  amountCents: Cents;
}

export interface PendingShiftRow {
  id: string;
  startedAt: number;
  paidMs: number;
  plannedCents: Cents;
}

export interface IncreaseOption {
  snapshotId: number;
  recordedAt: number;
  increaseCents: Cents;
  /** Parte do aumento ainda sem origem atribuída. */
  availableCents: Cents;
}

export interface AccountOption {
  id: string;
  name: string;
  balanceCents: Cents | null;
  increases: IncreaseOption[];
}

export interface ConfirmData {
  pending: PendingShiftRow[];
  pendingCents: Cents;
  accounts: AccountOption[];
  suggestedAccountId: string | null;
  /** true = sugere "Já atualizei" (há um aumento recente que cobre o valor). */
  suggestedAlreadyUpdated: boolean;
}

/** Aumentos com mais do que isto não aparecem para ligar. */
export const RECENT_INCREASE_DAYS = 60;
/** Um aumento até este limite é sugerido como "o dinheiro já entrou". */
const SUGGEST_DAYS = 14;

export function buildConfirmData({
  shifts,
  accounts,
  snapshots,
  attributions,
  now,
}: {
  shifts: ConfirmShift[];
  accounts: ConfirmAccountInput[];
  snapshots: ConfirmSnapshotInput[];
  attributions: ConfirmAttributionInput[];
  now: Date;
}): ConfirmData {
  const pending = shifts
    .filter((s) => s.endedAt != null && s.attributionId == null)
    .map((s) => {
      const e = estimateShift(s, s.endedAt!);
      return { id: s.id, startedAt: s.startedAt, paidMs: e.paidMs, plannedCents: e.plannedCents };
    })
    .sort((a, b) => a.startedAt - b.startedAt);
  const pendingCents = pending.reduce((sum, s) => sum + s.plannedCents, 0);

  const attributed = new Map<number, Cents>();
  for (const a of attributions) {
    if (a.snapshotId != null) attributed.set(a.snapshotId, (attributed.get(a.snapshotId) ?? 0) + a.amountCents);
  }

  // Aumento de cada atualização face à anterior da mesma conta. O primeiro saldo
  // de uma conta não é um aumento (é o ponto de partida).
  const previous = new Map<string, Cents>();
  const increases = new Map<string, IncreaseOption[]>();
  const ordered = [...snapshots].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime() || a.id - b.id);
  for (const snap of ordered) {
    const before = previous.get(snap.accountId);
    previous.set(snap.accountId, snap.balanceCents);
    if (before == null) continue;
    const increaseCents = snap.balanceCents - before;
    const availableCents = increaseCents - (attributed.get(snap.id) ?? 0);
    if (increaseCents <= 0 || availableCents <= 0) continue;
    if (now.getTime() - snap.recordedAt.getTime() > RECENT_INCREASE_DAYS * DAY_MS) continue;
    const list = increases.get(snap.accountId) ?? [];
    list.unshift({ snapshotId: snap.id, recordedAt: snap.recordedAt.getTime(), increaseCents, availableCents });
    increases.set(snap.accountId, list);
  }

  const active = accounts.filter((a) => !a.archived);
  const options: AccountOption[] = active.map((a) => ({
    id: a.id,
    name: a.name,
    balanceCents: a.balanceCents,
    increases: (increases.get(a.id) ?? []).slice(0, 10),
  }));

  // Sugestão: o aumento mais recente (últimos 14 dias) que cobre o valor planeado.
  const covering = options
    .flatMap((a) => a.increases.map((inc) => ({ accountId: a.id, inc })))
    .filter(({ inc }) => now.getTime() - inc.recordedAt <= SUGGEST_DAYS * DAY_MS && inc.availableCents >= pendingCents && pendingCents > 0)
    .sort((x, y) => y.inc.recordedAt - x.inc.recordedAt)[0];

  let suggestedAccountId = covering?.accountId ?? null;
  if (!suggestedAccountId) {
    // Senão, a conta atualizada mais recentemente (onde é provável que entre o dinheiro).
    const recent = [...active].sort((a, b) => (b.balanceUpdatedAt ?? "").localeCompare(a.balanceUpdatedAt ?? ""))[0];
    suggestedAccountId = recent?.id ?? null;
  }

  return {
    pending,
    pendingCents,
    accounts: options,
    suggestedAccountId,
    suggestedAlreadyUpdated: Boolean(covering),
  };
}
