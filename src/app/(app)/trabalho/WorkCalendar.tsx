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
import { buildComplete } from "@/components/work/clockHelpers";
import { useNow, useWorkClock } from "@/components/work/useWorkClock";
import { cn } from "@/lib/cn";
import { dayKey, formatDayHeading, formatTime, toLocalInput } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { haptic } from "@/lib/haptics";
import { formatHm } from "@/lib/work/format";
import { estimatePlannedShift } from "@/lib/work/shift";
import { addMinutesToTime } from "@/lib/work/today";
import type { CalendarEntry, WorkClientData } from "@/lib/work/view";
import { deleteScheduledShiftAction, saveScheduledShiftAction } from "./actions";

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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
  const localDone = new Set(clock.localDoneIds);
  const isDone = (e: CalendarEntry) => e.status === "done" || localDone.has(e.id);

  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of data.calendar) {
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
  const monthEntries = data.calendar.filter((e) => dayKey(new Date(e.startsAt)).startsWith(month));
  const monthPlanned = monthEntries.reduce((sum, e) => sum + estimatePlannedShift(e, data.settings).plannedCents, 0);

  return (
    <>
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={month <= minMonth}
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="rounded-full p-1.5 text-accent active:bg-card-2 disabled:opacity-30"
          >
            <ChevronLeftIcon size={22} />
          </button>
          <p className="font-semibold first-letter:uppercase">
            {MONTHS[m - 1]} {y}
          </p>
          <button
            type="button"
            aria-label="Mês seguinte"
            disabled={month >= maxMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="rounded-full p-1.5 text-accent active:bg-card-2 disabled:opacity-30"
          >
            <ChevronRightIcon size={22} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="pb-1 text-xs font-medium text-muted" aria-hidden>
              {d}
            </span>
          ))}
          {cells.map((key, i) => {
            if (!key) return <span key={`e${i}`} />;
            const entries = byDay.get(key) ?? [];
            const done = entries.length > 0 && entries.every(isDone);
            const pending = entries.some((e) => !isDone(e));
            const past = key < today;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-label={`${formatDayHeading(key, new Date(data.renderedAt))}${entries.length ? (done ? ", turno feito" : ", turno marcado") : ""}`}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm tabular-nums active:opacity-70",
                  done && "bg-success-soft text-success",
                  pending && !past && "bg-accent-soft text-accent",
                  pending && past && "border border-dashed border-accent text-accent",
                  !entries.length && past && "text-muted",
                  key === today && "ring-2 ring-accent",
                )}
              >
                <span className={cn(entries.length > 0 && "font-semibold")}>{Number(key.slice(8))}</span>
                {done && <CheckIcon size={12} strokeWidth={3} className="absolute bottom-1" />}
                {pending && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
        <p className="mt-3 px-1 text-sm text-muted tabular-nums">
          {monthEntries.length === 0
            ? "Toca num dia para marcar um turno."
            : `${monthEntries.length} ${monthEntries.length === 1 ? "turno" : "turnos"} este mês · ${formatEur(monthPlanned)} planeados para a mota`}
        </p>
      </Card>

      <Sheet open={selected != null} onClose={() => setSelected(null)} title={selected ? formatDayHeading(selected, new Date(data.renderedAt)) : ""}>
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
}: {
  day: string;
  now: number;
  data: WorkClientData;
  entries: CalendarEntry[];
  isDone: (e: CalendarEntry) => boolean;
  onDone: (entry: CalendarEntry) => void;
  onClose: () => void;
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
          <div key={entry.id} className="rounded-2xl bg-card-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-lg font-semibold tabular-nums">
                {formatTime(entry.startsAt)}–{formatTime(entry.endsAt)}
              </p>
              <p className={cn("font-semibold tabular-nums", done ? "text-success" : "text-accent")}>
                {formatEur(entry.doneCents ?? plan.plannedCents)}
              </p>
            </div>
            <p className="text-sm text-muted tabular-nums">
              {formatHm(plan.paidMs)} pagas{entry.unpaidBreakMinutes > 0 ? ` · ${entry.unpaidBreakMinutes} min de pausa` : ""} ·{" "}
              {done ? "feito" : "para a mota"}
            </p>
            {done ? (
              <Link href={`/trabalho/turnos/${entry.shiftId ?? entry.id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckIcon size={16} strokeWidth={3} /> Turno feito · ver resumo
              </Link>
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
                <RemoveButton id={entry.id} onDone={onClose} />
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
      <p className="font-semibold">{entry ? "Editar turno" : "Marcar turno"}</p>
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
        A saída é preenchida com {formatHm(data.defaultShiftMinutes * 60_000)} de turno. Se for antes da entrada, conta como no dia seguinte.
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

function RemoveButton({ id, onDone }: { id: string; onDone: () => void }) {
  const { pending, formProps } = useFormAction(deleteScheduledShiftAction, onDone, {
    confirmMessage: "Tirar este turno do calendário?",
  });
  return (
    <form {...formProps}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton pending={pending} variant="danger" size="sm" className="w-full" pendingText="…">
        Remover
      </SubmitButton>
    </form>
  );
}
