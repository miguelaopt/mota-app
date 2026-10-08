import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { Card, ListGroup, Section } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { getAccounts } from "@/lib/data/accounts";
import { getSnapshots } from "@/lib/data/snapshots";
import { getAttributions, getShifts } from "@/lib/data/work";
import { formatShortDate, formatTime } from "@/lib/dates";
import { DAY_MS } from "@/lib/finance/history";
import { formatEur } from "@/lib/finance/money";
import { formatHm } from "@/lib/work/format";
import { estimateShift } from "@/lib/work/shift";
import { ConfirmSavingsForm, type AccountOption, type PendingShiftRow } from "./ConfirmSavingsForm";
import { UndoAttributionButton } from "./UndoAttributionButton";

export const metadata: Metadata = { title: "Confirmar poupança" };

/** Atualizações de saldo mais antigas do que isto não aparecem para ligar. */
const RECENT_DAYS = 60;

export default async function ConfirmSavingsPage() {
  const { supabase } = await requireSession();
  const now = new Date();
  const [shifts, accounts, snapshots, attributions] = await Promise.all([
    getShifts(supabase),
    getAccounts(supabase),
    getSnapshots(supabase),
    getAttributions(supabase),
  ]);

  const pending: PendingShiftRow[] = shifts
    .filter((s) => s.endedAt != null && s.attributionId == null)
    .map((s) => {
      const e = estimateShift(s, s.endedAt!);
      return {
        id: s.id,
        label: `${formatShortDate(new Date(s.startedAt), now)} · ${formatHm(e.paidMs)}`,
        plannedCents: e.plannedCents,
      };
    });

  // Aumento de cada atualização de saldo face à anterior da mesma conta,
  // menos o que já foi atribuído ao trabalho.
  const attributedBySnapshot = new Map<number, number>();
  for (const a of attributions) {
    if (a.snapshotId != null) attributedBySnapshot.set(a.snapshotId, (attributedBySnapshot.get(a.snapshotId) ?? 0) + a.amountCents);
  }
  const previous = new Map<string, number>();
  const increases = new Map<string, AccountOption["increases"]>();
  for (const snap of snapshots) {
    const before = previous.get(snap.accountId) ?? 0;
    previous.set(snap.accountId, snap.balanceCents);
    const available = snap.balanceCents - before - (attributedBySnapshot.get(snap.id) ?? 0);
    if (available <= 0 || now.getTime() - snap.recordedAt.getTime() > RECENT_DAYS * DAY_MS) continue;
    const list = increases.get(snap.accountId) ?? [];
    list.unshift({
      snapshotId: snap.id,
      availableCents: available,
      label: `${formatShortDate(snap.recordedAt, now)}, ${formatTime(snap.recordedAt)} · ${formatEur(snap.balanceCents - before, { signed: true })} (${formatEur(available)} por atribuir)`,
    });
    increases.set(snap.accountId, list);
  }

  const options: AccountOption[] = accounts
    .filter((a) => !a.archived)
    .map((a) => ({ id: a.id, name: a.name, balanceCents: a.balanceCents, increases: (increases.get(a.id) ?? []).slice(0, 10) }));
  const names = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader
        title="Confirmar poupança"
        back={{ href: "/trabalho", label: "Trabalho" }}
        subtitle="Quando receberes e guardares, regista quanto foi e onde. Só assim o planeado passa a dinheiro contabilizado."
      />

      <Card>
        <ConfirmSavingsForm attributionId={randomUUID()} shifts={pending} accounts={options} />
      </Card>

      {attributions.length > 0 && (
        <Section title="Confirmações anteriores">
          <ListGroup>
            {attributions.slice(0, 30).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-3 pl-4 pr-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {formatEur(a.amountCents)} · {names.get(a.accountId) ?? "Conta"}
                  </p>
                  <p className="text-sm text-muted">
                    {formatShortDate(new Date(a.confirmedAt), now)}
                    {a.shiftIds.length > 0 && ` · ${a.shiftIds.length} ${a.shiftIds.length === 1 ? "turno" : "turnos"}`}
                    {a.notes && ` · ${a.notes}`}
                  </p>
                </div>
                <UndoAttributionButton id={a.id} />
              </div>
            ))}
          </ListGroup>
          <p className="mt-2 px-1 text-xs text-muted">
            Anular uma confirmação devolve os turnos a &quot;por confirmar&quot;. O saldo da conta e o histórico de saldos não mudam.
          </p>
        </Section>
      )}
    </>
  );
}
