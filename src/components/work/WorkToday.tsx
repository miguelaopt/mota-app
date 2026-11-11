"use client";

import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { Notice } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, StatRow } from "@/components/ui/Card";
import { DayTile } from "@/components/ui/DayTile";
import { Sheet } from "@/components/ui/Sheet";
import { undoKey } from "@/components/undo/keys";
import { formRunner, useUndo } from "@/components/undo/UndoProvider";
import { deleteScheduledShiftAction } from "@/app/(app)/trabalho/actions";
import { cn } from "@/lib/cn";
import { formatShiftDay, formatTime } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { haptic } from "@/lib/haptics";
import type { CompletedClockShift } from "@/lib/work/clock";
import { formatCountdown, formatHm } from "@/lib/work/format";
import { estimatePlannedShift, estimateShift, isUnusualShift } from "@/lib/work/shift";
import { todayView } from "@/lib/work/today";
import { TARGET_LABEL, targetCents, type CalendarEntry, type WorkClientData } from "@/lib/work/view";
import { buildComplete, earningsLabelLower } from "./clockHelpers";
import { useNow, useWorkClock, type WorkClock as Clock } from "./useWorkClock";

/**
 * O dia de trabalho: o turno de hoje (ou um esquecido) com o botão "Turno
 * feito", que regista o turno com o horário do calendário e mostra quanto
 * ficou planeado para a mota. Usado no Início e no ecrã Trabalho.
 */
export function WorkToday({ data, onHome = false }: { data: WorkClientData; onHome?: boolean }) {
  const clock = useWorkClock({ userId: data.userId, serverActive: data.activeShift, renderedAt: data.renderedAt });
  const now = useNow(true, data.renderedAt, 60_000);
  const { hidden, remove } = useUndo();
  // Turnos tirados do calendário ("Não fui") desaparecem logo, mesmo antes de o servidor responder.
  const calendar = data.calendar.filter((entry) => !hidden.has(undoKey.scheduled(entry.id)));
  const view = todayView({ calendar, settings: data.settings }, clock.localDoneIds, now);
  const showReward = clock.lastCompleted != null && clock.lastCompleted.id !== clock.dismissedCompletedId && clock.active == null;
  const today = new Date(now);
  const dayLabel = (at: number) => formatShiftDay(at, today);

  const markDone = (entry: CalendarEntry) => {
    if (!clock.dispatch(buildComplete(data, entry))) haptic(data.settings.haptics);
  };
  const skip = (entry: CalendarEntry) =>
    remove({
      label: `${dayLabel(entry.startsAt)}, ${formatTime(entry.startsAt)}: tirado do calendário`,
      keys: [undoKey.scheduled(entry.id)],
      run: formRunner(deleteScheduledShiftAction, { id: entry.id }),
    });

  // Turno picado à moda antiga a decorrer: o cartão desse turno trata disso.
  if (clock.active && onHome) return null;

  const tileEntry = view.main ?? view.laterToday ?? null;

  return (
    <>
      <SyncStatus clock={clock} />
      <Card className={cn("p-4", onHome && "mt-3")}>
        <div className="flex items-start gap-3.5">
          <DayTile at={tileEntry?.startsAt ?? now} done={!view.main && view.doneToday != null} />
          <div className="min-w-0 flex-1">
            {view.main ? (
              <>
                <p className="eyebrow text-accent">
                  {view.main.endsAt > now ? "Turno a decorrer" : "Por marcar"} · {dayLabel(view.main.startsAt).toLowerCase()}
                </p>
                <p className="display mt-1 text-2xl">
                  {formatTime(view.main.startsAt)} – {formatTime(view.main.endsAt)}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-muted tabular-nums">
                  {formatHm(plan(data, view.main).paidMs)} pagas ·{" "}
                  <span className="font-semibold text-accent">{formatEur(plan(data, view.main).plannedCents)}</span> para a mota
                </p>
              </>
            ) : view.doneToday ? (
              <>
                <p className="eyebrow text-success">Turno de hoje feito</p>
                <p className="display mt-1 text-2xl text-accent">{formatEur(view.doneToday.cents)}</p>
                <p className="mt-0.5 text-[0.8125rem] text-muted">planeados para a mota · confirma quando receberes</p>
              </>
            ) : view.laterToday ? (
              <>
                <p className="eyebrow">{data.settings.jobName} · hoje</p>
                <p className="display mt-1 text-2xl">
                  {formatTime(view.laterToday.startsAt)} – {formatTime(view.laterToday.endsAt)}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-muted tabular-nums">
                  começa daqui a <span className="font-semibold text-accent">{formatCountdown(view.laterToday.startsAt - now)}</span> ·{" "}
                  {formatEur(plan(data, view.laterToday).plannedCents)} para a mota
                </p>
              </>
            ) : (
              <>
                <p className="eyebrow">{data.settings.jobName}</p>
                <p className="display mt-1 text-2xl">{view.next ? "Hoje não tens turno" : "Sem turnos no calendário"}</p>
                {!view.next && (
                  <Link href="/trabalho#calendario" className="mt-1 inline-block text-sm font-medium text-accent">
                    Marcar os teus turnos
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {view.main && (
          <>
            <Button size="lg" className="mt-4 w-full" onClick={() => markDone(view.main!)}>
              <CheckIcon size={22} strokeWidth={2.6} /> Turno feito
            </Button>
            <button
              type="button"
              onClick={() => skip(view.main!)}
              className="mt-1 h-11 w-full text-sm font-medium text-muted active:opacity-60"
            >
              Não fui (folga ou turno cancelado)
            </button>
            {view.others.length > 0 && (
              <div className="mt-1 border-t border-sep pt-3">
                <p className="eyebrow text-faint">Também por marcar</p>
                {view.others.map((entry) => (
                  <div key={entry.id} className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-sm tabular-nums first-letter:uppercase">
                      {dayLabel(entry.startsAt)} · {formatTime(entry.startsAt)}–{formatTime(entry.endsAt)}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => markDone(entry)}>
                      Feito
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view.next && view.next !== view.laterToday && (
          <p className="mt-3 border-t border-sep pt-3 text-[0.8125rem] text-muted tabular-nums">
            Próximo:{" "}
            <span className="font-medium text-fg">
              {dayLabel(view.next.startsAt).toLowerCase()}, {formatTime(view.next.startsAt)}–{formatTime(view.next.endsAt)}
            </span>{" "}
            · {formatEur(plan(data, view.next).plannedCents)} para a mota
          </p>
        )}
        {onHome && (
          <Link href="/trabalho" className="mt-2 inline-flex min-h-9 items-center text-sm font-medium text-accent">
            Ver calendário
          </Link>
        )}
      </Card>

      <Sheet open={showReward} onClose={clock.dismissCompleted} title="Turno feito">
        {showReward && clock.lastCompleted && <Reward data={data} shift={clock.lastCompleted} onDone={clock.dismissCompleted} />}
      </Sheet>
    </>
  );
}

const plan = (data: WorkClientData, entry: CalendarEntry) => estimatePlannedShift(entry, data.settings);

export function SyncStatus({ clock }: { clock: Clock }) {
  if (!clock.error && clock.pendingCount === 0) return null;
  return (
    <div className="mb-3 space-y-2" aria-live="polite">
      {clock.pendingCount > 0 && (
        <Notice tone="neutral">
          Guardado no telemóvel. {clock.pendingCount === 1 ? "1 registo" : `${clock.pendingCount} registos`} à espera de rede para
          sincronizar.
        </Notice>
      )}
      {clock.error && (
        <Notice tone="danger" className="flex items-start justify-between gap-3">
          <span>{clock.error}</span>
          <button type="button" onClick={clock.clearError} className="shrink-0 font-semibold">
            OK
          </button>
        </Notice>
      )}
    </div>
  );
}

function Reward({ data, shift, onDone }: { data: WorkClientData; shift: CompletedClockShift; onDone: () => void }) {
  const e = estimateShift(shift, shift.endedAt);
  const model = data.motorcycle?.model ?? "mota";
  const goalCents = targetCents(data.goal, shift.target);
  const missingAfter = Math.max(0, goalCents - data.goal.savedCents - e.plannedCents);
  const unusual = isUnusualShift(e);
  const animate = data.settings.animations;

  return (
    <div className="space-y-4">
      <div className={cn("rounded-3xl border border-accent-line bg-accent-soft p-5 text-center", animate && "reward-pop")}>
        <p className="font-semibold tabular-nums">Turno concluído · {formatHm(e.paidMs)} pagas</p>
        <p className="mt-2 text-muted tabular-nums">
          {formatEur(e.earnedCents)} {earningsLabelLower(shift.payMode)}
        </p>
        <p className="display glow-text mt-2 text-[3rem] text-accent">{formatEur(e.plannedCents)}</p>
        <p className="font-medium">planeados para a {model}</p>
        {goalCents > 0 && e.plannedCents > 0 && (
          <p className="mt-3 text-sm text-muted tabular-nums">
            Se guardares este valor, faltam {formatEur(missingAfter)} para o {TARGET_LABEL[shift.target]}.
          </p>
        )}
      </div>

      <Card className="bg-card-2 py-2">
        <StatRow label="Duração total" value={formatHm(e.totalMs)} />
        <StatRow
          label="Pausas"
          value={formatHm(e.breakMs)}
          hint={e.unpaidBreakMs > 0 ? `${formatHm(e.unpaidBreakMs)} não remuneradas` : undefined}
        />
        <StatRow label="Duração paga" value={formatHm(e.paidMs)} />
        <StatRow label="Já guardado (real)" value={formatEur(data.goal.savedCents)} />
        <StatRow
          label="Projeção após guardar"
          value={<span className="text-accent">{formatEur(data.goal.savedCents + e.plannedCents)}</span>}
        />
      </Card>

      {unusual && <Notice>Duração invulgar ({formatHm(e.totalMs)}). Revê o horário: talvez te tenhas esquecido de picar a saída.</Notice>}

      <p className="px-1 text-sm text-muted">
        O saldo das contas não muda sozinho. Quando receberes e guardares o dinheiro, toca em &quot;Recebi&quot; no Início ou no Trabalho.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/trabalho/turnos/${shift.id}`} onClick={onDone} className={buttonClass("secondary")}>
          Corrigir horário
        </Link>
        <Button onClick={onDone}>Feito</Button>
      </div>
    </div>
  );
}
