import type { Metadata } from "next";
import Link from "next/link";
import { Card, ListGroup, Section } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getAccounts } from "@/lib/data/accounts";
import { getSnapshots } from "@/lib/data/snapshots";
import { dayKey, formatDayHeading, formatShortDate, formatTime } from "@/lib/dates";
import { summarizeAccounts } from "@/lib/finance/accounts";
import { formatEur } from "@/lib/finance/money";
import { DeleteEntryButton } from "./DeleteEntryButton";

export const metadata: Metadata = { title: "Histórico" };

const MAX_ENTRIES = 300;

export default async function HistoryPage() {
  const { supabase } = await requireSession();
  const [snapshots, accounts] = await Promise.all([getSnapshots(supabase), getAccounts(supabase)]);
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const summary = summarizeAccounts(accounts);
  const now = new Date();

  // Diferença face ao registo anterior da mesma conta.
  const previous = new Map<string, number>();
  const entries = snapshots.map((snapshot) => {
    const before = previous.get(snapshot.accountId);
    previous.set(snapshot.accountId, snapshot.balanceCents);
    return { ...snapshot, deltaCents: before == null ? null : snapshot.balanceCents - before };
  });
  const recent = entries.reverse().slice(0, MAX_ENTRIES);

  const days: Array<{ key: string; items: typeof recent }> = [];
  for (const entry of recent) {
    const key = dayKey(entry.recordedAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(entry);
    else days.push({ key, items: [entry] });
  }

  return (
    <>
      <PageHeader title="Histórico" />

      <Card>
        <p className="text-sm text-muted">Conta para a mota hoje</p>
        <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums">{formatEur(summary.totalCountedCents)}</p>
        <p className="mt-1 text-sm text-muted">
          {snapshots.length === 0
            ? "Ainda sem registos."
            : `${snapshots.length} ${snapshots.length === 1 ? "atualização" : "atualizações"} desde ${formatShortDate(snapshots[0].recordedAt, now)}`}
        </p>
      </Card>

      {days.length === 0 && (
        <p className="mt-6 px-1 text-center text-muted">
          Cada vez que atualizas o saldo de uma{" "}
          <Link href="/contas" className="text-accent">
            conta
          </Link>
          , o valor fica registado aqui.
        </p>
      )}

      {days.map((day) => (
        <Section key={day.key} title={formatDayHeading(day.key, now)}>
          <ListGroup>
            {day.items.map((entry) => {
              const name = names.get(entry.accountId) ?? "Conta";
              return (
                <div key={entry.id} className="flex items-center gap-3 py-3 pl-4 pr-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name}</p>
                    <p className="text-sm text-muted">{formatTime(entry.recordedAt)}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-semibold">{formatEur(entry.balanceCents)}</p>
                    {entry.deltaCents == null ? (
                      <p className="text-xs text-muted">primeiro registo</p>
                    ) : (
                      <p
                        className={cn(
                          "text-xs font-medium",
                          entry.deltaCents > 0 && "text-success",
                          entry.deltaCents < 0 && "text-danger",
                          entry.deltaCents === 0 && "text-muted",
                        )}
                      >
                        {formatEur(entry.deltaCents, { signed: true })}
                      </p>
                    )}
                  </div>
                  <DeleteEntryButton id={entry.id} label={`${name}, ${formatEur(entry.balanceCents)}`} />
                </div>
              );
            })}
          </ListGroup>
        </Section>
      ))}

      {entries.length > MAX_ENTRIES && (
        <p className="mt-4 px-1 text-center text-sm text-muted">A mostrar os {MAX_ENTRIES} registos mais recentes.</p>
      )}
    </>
  );
}
