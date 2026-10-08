"use client";

import Link from "next/link";
import { useState } from "react";
import { MotorcycleIcon, PauseIcon, PlayIcon, SparkIcon } from "@/components/icons";
import { Notice } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, StatRow } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/fields";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { formatShiftDay, formatTime, fromLocalInput, toLocalInput } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { haptic } from "@/lib/haptics";
import type { ClockShift, CompletedClockShift } from "@/lib/work/clock";
import { formatBp, formatClock, formatHm, formatHoursCeil, formatShortDuration } from "@/lib/work/format";
import { hoursToGoal, nextMilestone } from "@/lib/work/goal";
import { estimateAtPlannedEnd, estimatePlannedShift, estimateShift, isUnusualShift } from "@/lib/work/shift";
import { TARGET_LABEL, targetCents, type WorkClientData } from "@/lib/work/view";
import { buildClockIn, earningsLabel, earningsLabelLower } from "./clockHelpers";
import { newId, useNow, useWorkClock, type WorkClock as Clock } from "./useWorkClock";

type SheetKind = "start" | "late_start" | "planned_end" | "break" | "clock_out" | "motivation";
/** `at`: hora a que a folha foi aberta (valor inicial dos campos de hora). */
type SheetState = { kind: SheetKind; at: number } | null;

/** Relógio de ponto do ecrã Trabalho: entrada, turno em curso, pausas, saída e recompensa. */
export function WorkClock({ data }: { data: WorkClientData }) {
  const clock = useWorkClock({ userId: data.userId, serverActive: data.activeShift, renderedAt: data.renderedAt });
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = () => setSheet(null);
  const open = (kind: SheetKind) => setSheet({ kind, at: Date.now() });
  const kind = sheet?.kind ?? null;
  const openedAt = sheet?.at ?? data.renderedAt;
  const active = clock.active;
  const now = useNow(active != null, data.renderedAt);
  const showReward = clock.lastCompleted != null && clock.lastCompleted.id !== clock.dismissedCompletedId && !active;

  const run = (op: Parameters<Clock["dispatch"]>[0]) => {
    const error = clock.dispatch(op);
    if (!error) haptic(data.settings.haptics);
    return error;
  };

  return (
    <>
      <SyncStatus clock={clock} />

      {active ? (
        <ActiveShift data={data} shift={active} now={now} onSheet={open} run={run} />
      ) : (
        <IdleCard data={data} onClockIn={() => run(buildClockIn(data, Date.now()))} onLate={() => open("late_start")} />
      )}

      <Sheet open={kind === "late_start"} onClose={close} title="Picar entrada">
        {kind === "late_start" && (
          <TimeForm
            label="Hora de entrada"
            hint="Se te esqueceste de picar, indica quando entraste."
            initial={data.nextShift && data.nextShift.startsAt < openedAt ? data.nextShift.startsAt : openedAt}
            noFuture
            submit="Picar entrada"
            onSubmit={(at) => run(buildClockIn(data, at))}
            onDone={close}
          />
        )}
      </Sheet>

      {active && (
        <>
          <Sheet open={kind === "start"} onClose={close} title="Corrigir entrada">
            {kind === "start" && (
              <TimeForm
                label="Hora de entrada"
                initial={active.startedAt}
                noFuture
                submit="Guardar entrada"
                onSubmit={(at) => run({ type: "set_start", shiftId: active.id, at })}
                onDone={close}
              />
            )}
          </Sheet>

          <Sheet open={kind === "planned_end"} onClose={close} title="Saída prevista">
            {kind === "planned_end" && (
              <TimeForm
                label="Saída prevista"
                hint="Serve para mostrar quanto falta. O turno nunca termina sozinho."
                initial={active.plannedEndAt ?? openedAt + 60 * 60 * 1000}
                submit="Guardar"
                onSubmit={(at) => run({ type: "set_planned_end", shiftId: active.id, at })}
                onClear={active.plannedEndAt != null ? () => run({ type: "set_planned_end", shiftId: active.id, at: null }) : undefined}
                onDone={close}
              />
            )}
          </Sheet>

          <Sheet open={kind === "break"} onClose={close} title="Pausa">
            {kind === "break" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Numa pausa não remunerada a contagem pára. Numa pausa remunerada continua a contar como tempo pago.
                </p>
                {[data.settings.paidBreaks, !data.settings.paidBreaks].map((paid, i) => (
                  <Button
                    key={String(paid)}
                    variant={i === 0 ? "primary" : "secondary"}
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      if (!run({ type: "break_start", shiftId: active.id, breakId: newId(), at: Date.now(), paid })) close();
                    }}
                  >
                    {paid ? "Pausa remunerada" : "Pausa não remunerada"}
                  </Button>
                ))}
              </div>
            )}
          </Sheet>

          <Sheet open={kind === "clock_out"} onClose={close} title="Picar saída">
            {kind === "clock_out" && (
              <TimeForm
                label="Hora de saída"
                hint="Se te esqueceste de picar a saída, corrige aqui a hora."
                initial={openedAt}
                noFuture
                submit="Picar saída"
                onSubmit={(at) => run({ type: "clock_out", shiftId: active.id, at })}
                onDone={close}
              />
            )}
          </Sheet>

          <Sheet open={kind === "motivation"} onClose={close} title="Preciso de motivação">
            {kind === "motivation" && <Motivation data={data} shift={active} now={now} />}
          </Sheet>
        </>
      )}

      <Sheet open={showReward} onClose={clock.dismissCompleted} title="Turno concluído">
        {showReward && clock.lastCompleted && <Reward data={data} shift={clock.lastCompleted} onDone={clock.dismissCompleted} />}
      </Sheet>
    </>
  );
}

function SyncStatus({ clock }: { clock: Clock }) {
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

function IdleCard({ data, onClockIn, onLate }: { data: WorkClientData; onClockIn: () => void; onLate: () => void }) {
  const next = data.nextShift;
  const terms = data.settings;
  const plan = next ? estimatePlannedShift(next, terms) : null;

  return (
    <Card className="p-5">
      {next && plan ? (
        <>
          <p className="text-sm text-muted">Próximo turno</p>
          <p className="text-2xl font-bold leading-tight tabular-nums">
            {formatShiftDay(next.startsAt, new Date(data.renderedAt))} · {formatTime(next.startsAt)}–{formatTime(next.endsAt)}
          </p>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {formatHm(plan.paidMs)} pagas · {formatEur(plan.earnedCents)} {earningsLabelLower(terms.payMode)}
          </p>
          <p className="mt-3 text-lg font-semibold text-accent tabular-nums">
            {formatEur(plan.plannedCents)} planeados para a mota
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Sem turno planeado</p>
          <p className="text-2xl font-bold leading-tight tabular-nums">
            {formatEur(terms.hourlyRateCents)}/h · {formatBp(terms.allocationBp)} para a mota
          </p>
          <p className="mt-1 text-sm text-muted">Podes picar a entrada sempre que começares a trabalhar.</p>
        </>
      )}
      <Button size="lg" className="mt-5 w-full" onClick={onClockIn}>
        <PlayIcon size={20} /> Picar entrada
      </Button>
      <button type="button" onClick={onLate} className="mt-3 w-full text-center text-sm font-medium text-accent active:opacity-60">
        Esqueceste-te de picar? Indica a hora de entrada
      </button>
    </Card>
  );
}

function ActiveShift({
  data,
  shift,
  now,
  onSheet,
  run,
}: {
  data: WorkClientData;
  shift: ClockShift;
  now: number;
  onSheet: (kind: SheetKind) => void;
  run: (op: Parameters<Clock["dispatch"]>[0]) => string | null;
}) {
  const e = estimateShift({ ...shift, endedAt: null }, now);
  const atEnd = estimateAtPlannedEnd({ ...shift, endedAt: null }, now);
  const onBreak = e.openBreak;
  const model = data.motorcycle?.model ?? "mota";
  const plannedTotalMs = shift.plannedEndAt != null ? shift.plannedEndAt - shift.startedAt : null;
  const progressPct = plannedTotalMs ? (e.totalMs / plannedTotalMs) * 100 : 0;

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-orange-700">
        {data.motorcycle?.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.motorcycle.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="relative bg-gradient-to-t from-black/85 via-black/60 to-black/30 p-5 text-white">
          <p className="text-sm font-medium text-white/85">
            {onBreak ? (onBreak.paid ? "Em pausa remunerada" : "Em pausa não remunerada") : `Estás a trabalhar para a tua ${model}`}
          </p>
          <p className="mt-3 text-sm text-white/80">Planeado para a mota</p>
          <p className="text-[2.6rem] font-extrabold leading-none tracking-tight tabular-nums text-orange-200">
            {formatEur(e.plannedCents)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-white/75">{earningsLabel(shift.payMode)}</p>
              <p className="text-lg font-semibold tabular-nums">{formatEur(e.earnedCents)}</p>
            </div>
            <div>
              <p className="text-white/75">Tempo pago</p>
              <p className="text-lg font-semibold tabular-nums" role="timer" aria-live="off">
                {formatClock(e.paidMs)}
              </p>
            </div>
          </div>
          <MotorcycleIcon size={28} className="absolute right-5 top-5 text-white/70" aria-hidden />
        </div>
      </div>

      <Card className="mt-3 space-y-3">
        {shift.plannedEndAt != null ? (
          <>
            <ProgressBar pct={progressPct} label={`Progresso do turno: ${Math.floor(Math.min(100, progressPct))}%`} />
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">
                Entrada {formatTime(shift.startedAt)} · saída prevista {formatTime(shift.plannedEndAt)}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {e.overtimeMs > 0 ? (
                  <span className="text-warning">Saída prevista ultrapassada em {formatShortDuration(e.overtimeMs)}</span>
                ) : (
                  `Faltam ${formatHm(e.remainingMs ?? 0)}`
                )}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">
            Entrada às {formatTime(shift.startedAt)}.{" "}
            <button type="button" className="font-medium text-accent" onClick={() => onSheet("planned_end")}>
              Definir saída prevista
            </button>
          </p>
        )}
        {e.breakMs > 0 && (
          <StatRow
            label="Pausas"
            hint={e.unpaidBreakMs > 0 ? `${formatHm(e.unpaidBreakMs)} não remuneradas` : "remuneradas: contam como tempo pago"}
            value={formatHm(e.breakMs)}
          />
        )}
        {atEnd && e.overtimeMs === 0 && (
          <p className="text-sm text-muted tabular-nums">
            Na saída prevista: {formatEur(atEnd.plannedCents)} planeados ({formatEur(atEnd.earnedCents)} {earningsLabelLower(shift.payMode)}).
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {onBreak ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => run({ type: "break_end", shiftId: shift.id, breakId: onBreak.id, at: Date.now() })}
            >
              <PlayIcon size={20} /> Retomar
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onClick={() => onSheet("break")}>
              <PauseIcon size={20} /> Pausa
            </Button>
          )}
          <Button size="lg" onClick={() => onSheet("clock_out")}>
            Picar saída
          </Button>
        </div>
      </Card>

      <ShiftGoalImpact data={data} paidMs={e.paidMs} plannedCents={e.plannedCents} shift={shift} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-sm">
        <button type="button" className="font-medium text-accent active:opacity-60" onClick={() => onSheet("start")}>
          Corrigir entrada
        </button>
        {shift.plannedEndAt != null && (
          <button type="button" className="font-medium text-accent active:opacity-60" onClick={() => onSheet("planned_end")}>
            Mudar saída prevista
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1 font-medium text-muted active:opacity-60"
          onClick={() => onSheet("motivation")}
        >
          <SparkIcon size={16} /> Preciso de motivação
        </button>
      </div>
    </>
  );
}

/** Saldo real (que não muda) e a projeção com este turno, sempre separados. */
function ShiftGoalImpact({
  data,
  shift,
  paidMs,
  plannedCents,
}: {
  data: WorkClientData;
  shift: ClockShift;
  paidMs: number;
  plannedCents: number;
}) {
  const goalCents = targetCents(data.goal, shift.target);
  const missing = Math.max(0, goalCents - data.goal.savedCents);
  const hours = hoursToGoal(missing, shift.hourlyRateCents, shift.allocationBp);

  return (
    <Card className="mt-3 py-2">
      <StatRow label="Já guardado" hint="saldo real das contas; não muda durante o turno" value={formatEur(data.goal.savedCents)} />
      <StatRow
        label="Projeção se guardares este turno"
        value={<span className="text-accent">{formatEur(data.goal.savedCents + plannedCents)}</span>}
      />
      {hours.status === "ok" && (
        <StatRow
          label={`Horas pagas até ao ${TARGET_LABEL[shift.target]}`}
          hint={`com ${formatBp(shift.allocationBp)} para a mota · este turno: −${formatHm(paidMs)} (projeção)`}
          value={`≈ ${formatHoursCeil(hours.hours)} h`}
        />
      )}
    </Card>
  );
}

function Motivation({ data, shift, now }: { data: WorkClientData; shift: ClockShift; now: number }) {
  const e = estimateShift({ ...shift, endedAt: null }, now);
  const atEnd = estimateAtPlannedEnd({ ...shift, endedAt: null }, now);
  const model = data.motorcycle?.model ?? "mota";
  const milestone = nextMilestone(data.goal.savedCents, data.goal.minimumCents, data.goal.fullCents);
  const [broken, setBroken] = useState(false);

  const messages: string[] = [];
  if (atEnd && e.remainingMs) {
    messages.push(
      `Mais ${formatHm(e.remainingMs)} até à saída prevista. Este turno representa ${formatEur(atEnd.plannedCents)} planeados para a tua ${model}.`,
    );
  } else {
    messages.push(`Até agora, este turno já representa ${formatEur(e.plannedCents)} planeados para a tua ${model}.`);
  }
  if (data.completedForGoal > 0) {
    messages.push(
      `Já registaste ${data.completedForGoal} ${data.completedForGoal === 1 ? "turno" : "turnos"} por este objetivo. Hoje acrescentas mais um passo.`,
    );
  }
  if (milestone) {
    const afterPlanned = milestone.cents - data.goal.savedCents - data.pendingPlannedCents - (atEnd?.plannedCents ?? e.plannedCents);
    messages.push(
      afterPlanned > 0
        ? `Faltam ${formatEur(afterPlanned)} para o próximo marco (${milestone.label}), se confirmares a poupança planeada.`
        : `Com a poupança planeada, chegas ao próximo marco: ${milestone.label}.`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-orange-700">
        {data.motorcycle?.photoUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.motorcycle.photoUrl} alt={model} onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/85">
            <MotorcycleIcon size={96} strokeWidth={1.4} />
          </div>
        )}
        <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-10 text-2xl font-bold text-white">
          {model}
        </p>
      </div>
      <ul className="space-y-3">
        {messages.map((m) => (
          <li key={m} className="rounded-2xl bg-card-2 px-4 py-3 leading-snug">
            {m}
          </li>
        ))}
      </ul>
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

/** Formulário de hora (datetime-local na hora de Lisboa). */
function TimeForm({
  label,
  hint,
  initial,
  noFuture,
  submit,
  onSubmit,
  onClear,
  onDone,
}: {
  label: string;
  hint?: string;
  initial: number;
  /** Não aceita horas no futuro (com 1 minuto de folga). */
  noFuture?: boolean;
  submit: string;
  onSubmit: (at: number) => string | null;
  onClear?: () => string | null;
  onDone: () => void;
}) {
  const [value, setValue] = useState(() => toLocalInput(initial));
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const date = fromLocalInput(value);
        if (!date) return setError("Indica uma data e hora válidas.");
        if (noFuture && date.getTime() > Date.now() + 60_000) return setError("Não pode ser no futuro.");
        const problem = onSubmit(date.getTime());
        if (problem) setError(problem);
        else onDone();
      }}
    >
      <Field label={label} htmlFor="time-form-value" hint={hint}>
        <input
          id="time-form-value"
          type="datetime-local"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={cn(inputClass, "tabular-nums")}
          required
        />
      </Field>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full">
        {submit}
      </Button>
      {onClear && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            if (!onClear()) onDone();
          }}
        >
          Remover saída prevista
        </Button>
      )}
    </form>
  );
}
