import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, ListGroup, Section } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { undoKey } from "@/components/undo/keys";
import { Removable } from "@/components/undo/UndoProvider";
import { requireSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getAccounts } from "@/lib/data/accounts";
import { getSnapshots } from "@/lib/data/snapshots";
import { getAttributions, getShifts, getWorkSettings } from "@/lib/data/work";
import { dayKey, formatDayHeading, formatShortDate, formatTime } from "@/lib/dates";
import { summarizeAccounts } from "@/lib/finance/accounts";
import { totalSeries } from "@/lib/finance/history";
import { formatEur } from "@/lib/finance/money";
import { formatHm } from "@/lib/work/format";
import { estimateShift } from "@/lib/work/shift";
import { DeleteEntryButton } from "./DeleteEntryButton";
import { EvolutionChartLazy } from "./EvolutionChartLazy";

export const metadata: Metadata = { title: "Histórico" };

const MAX_ENTRIES = 300;

const FILTERS = [
  { key: "tudo", label: "Tudo" },
  { key: "contas", label: "Contas" },
  { key: "trabalho", label: "Trabalho" },
  { key: "poupanca", label: "Poupança" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

interface HistoryEvent {
  key: string;
  /** Chave para esconder a linha enquanto espera pelo "Anular". */
  undo?: string;
  at: Date;
  group: Exclude<Filter, "tudo">;
  node: ReactNode;
}

function Row({
  title,
  subtitle,
  value,
  detail,
  action,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex min-h-14 items-center gap-3 py-3 pl-4", action ? "pr-1.5" : "pr-4")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <div className="text-right tabular-nums">
        <p className="display text-[1.25rem] leading-[1.1]">{value}</p>
        {detail}
      </div>
      {action}
    </div>
  );
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ f?: string | string[] }> }) {
  const { f } = await searchParams;
  const filter: Filter = FILTERS.some((x) => x.key === f) ? (f as Filter) : "tudo";
  const { supabase } = await requireSession();
  const [snapshots, accounts, workSettings] = await Promise.all([getSnapshots(supabase), getAccounts(supabase), getWorkSettings(supabase)]);
  const [shifts, attributions] = workSettings ? await Promise.all([getShifts(supabase), getAttributions(supabase)]) : [[], []];
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const summary = summarizeAccounts(accounts);
  const now = new Date();

  const workBySnapshot = new Map<number, number>();
  for (const a of attributions) {
    if (a.snapshotId != null) workBySnapshot.set(a.snapshotId, (workBySnapshot.get(a.snapshotId) ?? 0) + a.amountCents);
  }

  const events: HistoryEvent[] = [];

  // Atualizações de saldo (regras financeiras existentes).
  const previous = new Map<string, number>();
  for (const snapshot of snapshots) {
    const before = previous.get(snapshot.accountId);
    previous.set(snapshot.accountId, snapshot.balanceCents);
    const delta = before == null ? null : snapshot.balanceCents - before;
    const name = names.get(snapshot.accountId) ?? "Conta";
    const fromWork = workBySnapshot.get(snapshot.id);
    events.push({
      key: `s-${snapshot.id}`,
      undo: undoKey.snapshot(snapshot.id),
      at: snapshot.recordedAt,
      group: "contas",
      node: (
        <Row
          title={name}
          subtitle={
            <>
              {formatTime(snapshot.recordedAt)}
              {fromWork != null && <span className="text-success"> · {formatEur(fromWork)} do trabalho</span>}
            </>
          }
          value={formatEur(snapshot.balanceCents)}
          detail={
            delta == null ? (
              <p className="text-xs text-muted">primeiro registo</p>
            ) : (
              <p
                className={cn("text-xs font-medium", delta > 0 && "text-success", delta < 0 && "text-danger", delta === 0 && "text-muted")}
              >
                {formatEur(delta, { signed: true })}
              </p>
            )
          }
          action={<DeleteEntryButton id={snapshot.id} label={`${name}, ${formatEur(snapshot.balanceCents)}`} />}
        />
      ),
    });
  }

  // Turnos: só estimativas e intenção de poupança (nunca mexem no saldo).
  for (const shift of shifts) {
    if (shift.endedAt == null) {
      events.push({
        key: `a-${shift.id}`,
        at: new Date(shift.startedAt),
        group: "trabalho",
        node: (
          <Link href="/trabalho" className="block active:bg-card-2">
            <Row title="Turno a decorrer" subtitle={`entrada ${formatTime(shift.startedAt)}`} value={<Badge tone="accent">Ativo</Badge>} />
          </Link>
        ),
      });
      continue;
    }
    const e = estimateShift(shift, shift.endedAt);
    events.push({
      key: `t-${shift.id}`,
      at: new Date(shift.endedAt),
      group: "trabalho",
      node: (
        <Link href={`/trabalho/turnos/${shift.id}`} className="block active:bg-card-2">
          <Row
            title="Turno terminado"
            subtitle={`${formatTime(shift.startedAt)}–${formatTime(shift.endedAt)} · ${formatHm(e.paidMs)} pagas`}
            value={<span className="text-accent">{formatEur(e.plannedCents)}</span>}
            detail={<p className="text-xs text-muted">{shift.attributionId ? "planeado · confirmado" : "planeado"}</p>}
          />
        </Link>
      ),
    });
    if (shift.version > 1 && shift.editedAt && shift.originalStartedAt) {
      events.push({
        key: `c-${shift.id}`,
        at: new Date(shift.editedAt),
        group: "trabalho",
        node: (
          <Link href={`/trabalho/turnos/${shift.id}`} className="block active:bg-card-2">
            <Row
              title="Turno corrigido"
              subtitle={`${formatShortDate(new Date(shift.startedAt), now)}: antes ${formatTime(shift.originalStartedAt)}–${shift.originalEndedAt ? formatTime(shift.originalEndedAt) : "?"}`}
              value={`${formatTime(shift.startedAt)}–${formatTime(shift.endedAt)}`}
              detail={<p className="text-xs text-muted">estimativa recalculada</p>}
            />
          </Link>
        ),
      });
    }
  }

  // Poupança do trabalho confirmada: classifica uma atualização de saldo, sem a voltar a somar.
  for (const a of attributions) {
    events.push({
      key: `p-${a.id}`,
      at: new Date(a.confirmedAt),
      group: "poupanca",
      node: (
        <Row
          title="Poupança confirmada"
          subtitle={`${formatTime(a.confirmedAt)} · ${names.get(a.accountId) ?? "Conta"}${a.shiftIds.length ? ` · ${a.shiftIds.length} ${a.shiftIds.length === 1 ? "turno" : "turnos"}` : ""}`}
          value={<span className="text-success">{formatEur(a.amountCents)}</span>}
          detail={<p className="text-xs text-muted">{a.snapshotId == null ? "registo de saldo apagado" : "já incluído no saldo"}</p>}
        />
      ),
    });
  }

  const filtered = events.filter((e) => filter === "tudo" || e.group === filter).sort((a, b) => b.at.getTime() - a.at.getTime());
  const recent = filtered.slice(0, MAX_ENTRIES);

  const evolution = totalSeries(snapshots).map((p) => ({ t: p.at.getTime(), v: p.totalCents }));

  const days: Array<{ key: string; items: HistoryEvent[] }> = [];
  for (const event of recent) {
    const key = dayKey(event.at);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(event);
    else days.push({ key, items: [event] });
  }

  return (
    <>
      <PageHeader title="Histórico" />

      <Card className="p-[1.125rem]">
        <p className="eyebrow">Conta para a mota hoje</p>
        <p className="display mt-1 text-[clamp(2.25rem,12.5vw,3.125rem)] leading-[0.95]">{formatEur(summary.totalCountedCents)}</p>
        <p className="mt-1 text-[0.8125rem] text-muted">
          {snapshots.length === 0
            ? "Ainda sem registos."
            : `${snapshots.length} ${snapshots.length === 1 ? "atualização" : "atualizações"} desde ${formatShortDate(snapshots[0].recordedAt, now)}`}
        </p>
        {snapshots.length > 0 && (
          <div className="mt-4 border-t border-sep pt-3">
            <EvolutionChartLazy points={evolution} now={now.getTime()} />
          </div>
        )}
      </Card>

      {workSettings && (
        <nav aria-label="Filtrar histórico" className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={x.key === "tudo" ? "/historico" : `/historico?f=${x.key}`}
              aria-current={x.key === filter ? "page" : undefined}
              className={cn(
                "flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium",
                x.key === filter
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-glass-border bg-white/[0.05] text-muted active:opacity-70",
              )}
            >
              {x.label}
            </Link>
          ))}
        </nav>
      )}

      {days.length === 0 && (
        <p className="mt-6 px-1 text-center text-muted">
          {filter === "trabalho" ? (
            "Os turnos terminados aparecem aqui."
          ) : filter === "poupanca" ? (
            "As confirmações de poupança do trabalho aparecem aqui."
          ) : (
            <>
              Cada vez que atualizas o saldo de uma{" "}
              <Link href="/contas" className="text-accent">
                conta
              </Link>
              , o valor fica registado aqui.
            </>
          )}
        </p>
      )}

      {days.map((day) => (
        <Section key={day.key} title={formatDayHeading(day.key, now)}>
          <ListGroup>
            {day.items.map((event) =>
              event.undo ? (
                <Removable key={event.key} id={event.undo}>
                  <div>{event.node}</div>
                </Removable>
              ) : (
                <div key={event.key}>{event.node}</div>
              ),
            )}
          </ListGroup>
        </Section>
      ))}

      {filtered.length > MAX_ENTRIES && (
        <p className="mt-4 px-1 text-center text-sm text-muted">A mostrar os {MAX_ENTRIES} registos mais recentes.</p>
      )}
    </>
  );
}
