"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FormError, Select, TextInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/Sheet";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { undoKey } from "@/components/undo/keys";
import { formRunner, useUndo } from "@/components/undo/UndoProvider";
import { buildComplete } from "@/components/work/clockHelpers";
import { useNow, useWorkClock } from "@/components/work/useWorkClock";
import { cn } from "@/lib/cn";
import { dayKey, formatDayHeading, formatShortDate, formatTime, toLocalInput } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { haptic } from "@/lib/haptics";
import { formatHm } from "@/lib/work/format";
import { estimatePlannedShift } from "@/lib/work/shift";
import { addMinutesToTime } from "@/lib/work/today";
import type { CalendarEntry, WorkClientData } from "@/lib/work/view";
import { deleteScheduledShiftAction, saveScheduledShiftAction } from "./actions";

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-10" ± n meses. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Calendário mensal dos turnos: marcar o horário, "Turno feito", editar e remover. */
export function WorkCalendar({ data }: { data: WorkClientData }) {
  const clock = useWorkClock({ userId: data.userId, serverActive: data.activeShift, renderedAt: data.renderedAt });
  const now = useNow(true, data.renderedAt, 60_000);
  const today = dayKey(new Date(now));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const { hidden, remove } = useUndo();
  const localDone = new Set(clock.localDoneIds);
  const isDone = (e: CalendarEntry) => e.status === "done" || localDone.has(e.id);
  const calendar = data.calendar.filter((e) => !hidden.has(undoKey.scheduled(e.id)));

  const removeEntry = (entry: CalendarEntry) => {
    setSelected(null);
    remove({
      label: `Turno de ${formatShortDate(new Date(entry.startsAt), new Date(now))} removido`,
      keys: [undoKey.scheduled(entry.id)],
      run: formRunner(deleteScheduledShiftAction, { id: entry.id }),
    });
  };

  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of calendar) {
    const key = dayKey(new Date(entry.startsAt));
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // segunda-feira primeiro
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<string | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const minMonth = shiftMonth(today.slice(0, 7), -1);
  const maxMonth = shiftMonth(today.slice(0, 7), 3);
  const monthEntries = calendar.filter((e) => dayKey(new Date(e.startsAt)).startsWith(month));
  const monthPlanned = monthEntries.reduce((sum, e) => sum + (e.doneCents ?? estimatePlannedShift(e, data.settings).plannedCents), 0);
  const monthDone = monthEntries.filter(isDone).length;

  return (
    <>
      {/* Resumo do mês mostrado */}
      <div className="glass mb-3 grid grid-cols-[0.8fr_1fr_1.6fr] rounded-[20px] p-3" aria-live="polite">
        <div className="px-1.5 py-1">
          <p className="text-[0.6875rem] text-muted">Feitos</p>
          <p className="display mt-0.5 text-[1.625rem] text-accent">{monthDone}</p>
        </div>
        <div className="border-l border-sep px-3 py-1">
          <p className="text-[0.6875rem] text-muted">Por fazer</p>
          <p className="display mt-0.5 text-[1.625rem]">{monthEntries.length - monthDone}</p>
        </div>
        <div className="min-w-0 border-l border-sep px-3 py-1">
          <p className="text-[0.6875rem] text-muted">Mês planeado</p>
          <p className="display mt-0.5 truncate text-[1.625rem]">{formatEur(monthPlanned)}</p>
        </div>
      </div>

      <Card className="px-3 pb-3 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={month <= minMonth}
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-accent active:bg-card-2 disabled:opacity-30"
          >
            <ChevronLeftIcon size={22} />
          </button>
          <p className="display text-[1.375rem] tracking-[0.02em] first-letter:uppercase">
            {MONTHS[m - 1]} {y}
          </p>
          <button
            type="button"
            aria-label="Mês seguinte"
            disabled={month >= maxMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-accent active:bg-card-2 disabled:opacity-30"
          >
            <ChevronRightIcon size={22} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-[5px] text-center">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="pb-1 text-[0.6875rem] font-semibold text-faint" aria-hidden>
              {d}
            </span>
          ))}
          {cells.map((key, i) => {
            if (!key) return <span key={`e${i}`} />;
            const entries = byDay.get(key) ?? [];
            const done = entries.length > 0 && entries.every(isDone);
            const pending = entries.some((e) => !isDone(e));
            const past = key < today;
            const isToday = key === today;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-label={`${formatDayHeading(key, new Date(data.renderedAt))}${entries.length ? (done ? ", turno feito" : ", turno marcado") : ""}`}
                className={cn(
                  "display relative flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[1.0625rem] active:opacity-70",
                  done && "border border-accent/35 bg-accent/[0.16] text-accent",
                  pending && !past && !isToday && "border border-white/10 bg-white/[0.05]",
                  pending && past && "border border-dashed border-accent/70 text-accent",
                  !entries.length && "font-medium text-faint",
                  isToday &&
                    !done &&
                    "border-[1.5px] border-accent bg-accent/[0.06] font-bold text-fg shadow-[0_0_16px_rgb(42_245_179/0.3)]",
                )}
              >
                {Number(key.slice(8))}
                {pending && <span className="h-1 w-1 rounded-full bg-accent/80" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 px-1.5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-accent/50 bg-accent/30" aria-hidden />
            feito
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-white/15 bg-white/[0.08]" aria-hidden />
            marcado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-accent" aria-hidden />
            hoje
          </span>
        </div>
        {monthEntries.length === 0 && <p className="mt-2 px-1.5 text-sm text-muted">Toca num dia para marcar um turno.</p>}
      </Card>

      <Sheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? formatDayHeading(selected, new Date(data.renderedAt)) : ""}
      >
        {selected && (
          <DaySheet
            key={selected}
            day={selected}
            data={data}
            entries={byDay.get(selected) ?? []}
            now={now}
            isDone={isDone}
            onDone={(entry) => {
              if (!clock.dispatch(buildComplete(data, entry))) haptic(data.settings.haptics);
              setSelected(null);
            }}
            onClose={() => setSelected(null)}
            onRemove={removeEntry}
          />
        )}
      </Sheet>
    </>
  );
}

function DaySheet({
  day,
  data,
  entries,
  isDone,
  now,
  onDone,
  onClose,
  onRemove,
}: {
  day: string;
  now: number;
  data: WorkClientData;
  entries: CalendarEntry[];
  isDone: (e: CalendarEntry) => boolean;
  onDone: (entry: CalendarEntry) => void;
  onClose: () => void;
  onRemove: (entry: CalendarEntry) => void;
}) {
  const [editing, setEditing] = useState<CalendarEntry | null>(null);
  const [adding, setAdding] = useState(entries.length === 0);

  if (editing) return <ScheduleForm data={data} day={day} entry={editing} onDone={onClose} />;

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        const plan = estimatePlannedShift(entry, data.settings);
        const done = isDone(entry);
        return (
          <div key={entry.id} className="rounded-[18px] border border-glass-border bg-card-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="display text-2xl">
                {formatTime(entry.startsAt)} – {formatTime(entry.endsAt)}
              </p>
              <p className={cn("display text-xl", done ? "text-success" : "text-accent")}>
                {formatEur(entry.doneCents ?? plan.plannedCents)}
              </p>
            </div>
            <p className="text-sm text-muted tabular-nums">
              {formatHm(plan.paidMs)} pagas{entry.unpaidBreakMinutes > 0 ? ` · ${entry.unpaidBreakMinutes} min de pausa` : ""} ·{" "}
              {done ? "feito" : "para a mota"}
            </p>
            {done ? (
              entry.shiftId ? (
                <Link
                  href={`/trabalho/turnos/${entry.shiftId}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-success"
                >
                  <CheckIcon size={16} strokeWidth={3} /> Turno feito · ver resumo
                </Link>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckIcon size={16} strokeWidth={3} /> Turno feito · a sincronizar…
                </p>
              )
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {entry.startsAt <= now ? (
                  <Button className="col-span-2" onClick={() => onDone(entry)}>
                    <CheckIcon size={20} strokeWidth={2.6} /> Turno feito
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => setEditing(entry)}>
                  Editar
                </Button>
                <Button variant="danger" size="sm" onClick={() => onRemove(entry)}>
                  Remover
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <ScheduleForm data={data} day={day} onDone={onClose} />
      ) : (
        <Button variant="ghost" className="w-full" onClick={() => setAdding(true)}>
          Adicionar outro turno neste dia
        </Button>
      )}
    </div>
  );
}

function ScheduleForm({ data, day, entry, onDone }: { data: WorkClientData; day: string; entry?: CalendarEntry; onDone: () => void }) {
  const { error, pending, formProps } = useFormAction(saveScheduledShiftAction, onDone);
  const initialStart = entry ? toLocalInput(entry.startsAt).slice(11) : (data.lastStartTime ?? "");
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(
    entry ? toLocalInput(entry.endsAt).slice(11) : initialStart ? addMinutesToTime(initialStart, data.defaultShiftMinutes) : "",
  );
  const [endTouched, setEndTouched] = useState(Boolean(entry));

  return (
    <form {...formProps} className="space-y-4">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <input type="hidden" name="date" value={day} />
      <p className="eyebrow">{entry ? "Editar turno" : "Marcar turno"}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entrada" htmlFor="start">
          <TextInput
            id="start"
            name="start"
            type="time"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (!endTouched && e.target.value) setEnd(addMinutesToTime(e.target.value, data.defaultShiftMinutes));
            }}
            required
          />
        </Field>
        <Field label="Saída" htmlFor="end">
          <TextInput
            id="end"
            name="end"
            type="time"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setEndTouched(true);
            }}
            required
          />
        </Field>
      </div>
      <p className="-mt-2 px-1 text-xs text-muted">
        A saída é preenchida com {formatHm(data.defaultShiftMinutes * 60_000)} de turno. Se for antes da entrada, conta como no dia
        seguinte.
      </p>
      <Field label="Pausa não remunerada (minutos)" htmlFor="unpaid_break_minutes">
        <TextInput
          id="unpaid_break_minutes"
          name="unpaid_break_minutes"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={entry?.unpaidBreakMinutes ? String(entry.unpaidBreakMinutes) : ""}
          placeholder="0"
        />
      </Field>
      {!entry && (
        <Field label="Repetir à mesma hora" htmlFor="repeat_weeks">
          <Select id="repeat_weeks" name="repeat_weeks" defaultValue="0">
            <option value="0">Só neste dia</option>
            <option value="3">Todas as semanas, durante 4 semanas</option>
            <option value="7">Todas as semanas, durante 8 semanas</option>
            <option value="11">Todas as semanas, durante 12 semanas</option>
          </Select>
        </Field>
      )}
      <FormError error={error} />
      <SubmitButton pending={pending} size="lg" className="w-full">
        {entry ? "Guardar" : "Marcar turno"}
      </SubmitButton>
    </form>
  );
}
