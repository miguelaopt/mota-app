"use client";

import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { Notice } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, StatRow } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { useFormAction } from "@/components/ui/useFormAction";
import { deleteScheduledShiftAction } from "@/app/(app)/trabalho/actions";
import { cn } from "@/lib/cn";
import { formatShiftDay, formatTime } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { haptic } from "@/lib/haptics";
import type { CompletedClockShift } from "@/lib/work/clock";
import { formatHm } from "@/lib/work/format";
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
  const view = todayView(data, clock.localDoneIds, now);
  const showReward = clock.lastCompleted != null && clock.lastCompleted.id !== clock.dismissedCompletedId && clock.active == null;

  const markDone = (entry: CalendarEntry) => {
    if (!clock.dispatch(buildComplete(data, entry))) haptic(data.settings.haptics);
  };

  // Turno picado à moda antiga a decorrer: o cartão desse turno trata disso.
  if (clock.active && onHome) return null;

  return (
    <>
      <SyncStatus clock={clock} />
      <Card className={cn("p-5", onHome && "mt-4 p-4")}>
        {view.main ? (
          <>
            <p className="text-sm font-medium text-accent">{view.main.endsAt > now ? "Turno a decorrer" : "Por marcar"}</p>
            <p className="text-2xl font-bold leading-tight tabular-nums first-letter:uppercase">
              {formatShiftDay(view.main.startsAt, new Date(now))} · {formatTime(view.main.startsAt)}–{formatTime(view.main.endsAt)}
            </p>
            <p className="mt-1 text-sm text-muted tabular-nums">
              {formatHm(plan(data, view.main).paidMs)} pagas ·{" "}
              <span className="font-medium text-accent">{formatEur(plan(data, view.main).plannedCents)} para a mota</span>
            </p>
            <Button size="lg" className="mt-4 w-full" onClick={() => markDone(view.main!)}>
              <CheckIcon size={22} strokeWidth={2.6} /> Turno feito
            </Button>
            <SkipButton id={view.main.id} />
            {view.others.length > 0 && (
              <div className="mt-3 border-t border-sep pt-3">
                <p className="text-sm text-muted">Também por marcar</p>
                {view.others.map((entry) => (
                  <div key={entry.id} className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-sm tabular-nums first-letter:uppercase">
                      {formatShiftDay(entry.startsAt, new Date(now))} · {formatTime(entry.startsAt)}–{formatTime(entry.endsAt)}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => markDone(entry)}>
                      Feito
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : view.doneToday ? (
          <>
            <p className="flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckIcon size={16} strokeWidth={3} /> Turno de hoje feito
            </p>
            <p className="text-2xl font-bold tabular-nums">{formatEur(view.doneToday.cents)} planeados para a mota</p>
            <p className="text-sm text-muted">O saldo só muda quando guardares o dinheiro e confirmares a poupança.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{data.settings.jobName}</p>
            <p className="text-lg font-bold">{view.next ? "Hoje não tens turno" : "Sem turnos no calendário"}</p>
            {!view.next && (
              <Link href="/trabalho#calendario" className="mt-1 inline-block text-sm font-medium text-accent">
                Marcar os teus turnos
              </Link>
            )}
          </>
        )}

        {view.next && (
          <p className={cn("text-sm text-muted tabular-nums", (view.main || view.doneToday) && "mt-3 border-t border-sep pt-3")}>
            Próximo turno:{" "}
            <span className="font-medium text-fg first-letter:uppercase">
              {formatShiftDay(view.next.startsAt, new Date(now)).toLowerCase()}, {formatTime(view.next.startsAt)}–{formatTime(view.next.endsAt)}
            </span>{" "}
            · {formatEur(plan(data, view.next).plannedCents)} para a mota
          </p>
        )}
        {onHome && (
          <Link href="/trabalho" className="mt-3 inline-block text-sm font-medium text-accent">
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

/** "Não fui": tira o turno do calendário (não regista nada). */
function SkipButton({ id }: { id: string }) {
  const { pending, formProps } = useFormAction(deleteScheduledShiftAction, undefined, {
    confirmMessage: "Não foste a este turno? Sai do calendário e não conta para nada.",
  });
  return (
    <form {...formProps} className="mt-2 text-center">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-sm font-medium text-muted active:opacity-60 disabled:opacity-50">
        Não fui (folga ou turno cancelado)
      </button>
    </form>
  );
}

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
      <div className={cn("rounded-3xl bg-accent-soft p-5 text-center", animate && "reward-pop")}>
        <p className="font-semibold tabular-nums">Turno concluído · {formatHm(e.paidMs)} pagas</p>
        <p className="mt-2 text-muted tabular-nums">
          {formatEur(e.earnedCents)} {earningsLabelLower(shift.payMode)}
        </p>
        <p className="mt-1 text-[2rem] font-extrabold leading-tight tracking-tight text-accent tabular-nums">
          {formatEur(e.plannedCents)}
        </p>
        <p className="font-medium">planeados para a {model}</p>
        {goalCents > 0 && e.plannedCents > 0 && (
          <p className="mt-3 text-sm text-muted tabular-nums">
            Se guardares este valor, faltam {formatEur(missingAfter)} para o {TARGET_LABEL[shift.target]}.
          </p>
        )}
      </div>

      <Card className="bg-card-2 py-2">
        <StatRow label="Duração total" value={formatHm(e.totalMs)} />
        <StatRow label="Pausas" value={formatHm(e.breakMs)} hint={e.unpaidBreakMs > 0 ? `${formatHm(e.unpaidBreakMs)} não remuneradas` : undefined} />
        <StatRow label="Duração paga" value={formatHm(e.paidMs)} />
        <StatRow label="Já guardado (real)" value={formatEur(data.goal.savedCents)} />
        <StatRow label="Projeção após guardar" value={<span className="text-accent">{formatEur(data.goal.savedCents + e.plannedCents)}</span>} />
      </Card>

      {unusual && (
        <Notice>
          Duração invulgar ({formatHm(e.totalMs)}). Revê o horário: talvez te tenhas esquecido de picar a saída.
        </Notice>
      )}

      <p className="px-1 text-sm text-muted">
        O saldo das contas não muda sozinho. Quando receberes e guardares o dinheiro, confirma a poupança no ecrã Trabalho.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/trabalho/turnos/${shift.id}`}
          onClick={onDone}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-card-2 px-4 font-semibold active:opacity-70"
        >
          Corrigir horário
        </Link>
        <Button onClick={onDone}>Feito</Button>
      </div>
    </div>
  );
}
