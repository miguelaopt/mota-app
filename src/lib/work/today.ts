import { dayKey } from "@/lib/dates";
import { DAY_MS } from "@/lib/finance/history";
import { estimatePlannedShift } from "./shift";
import type { CalendarEntry, WorkClientData } from "./view";

/** Turnos do calendário ainda por marcar há mais do que isto deixam de ser sugeridos. */
const FORGOTTEN_DAYS = 14;

/** O que mostrar hoje, a partir do calendário e do que já foi marcado neste telemóvel. */
export function todayView(data: Pick<WorkClientData, "calendar" | "settings">, localDoneIds: string[], now: number) {
  const local = new Set(localDoneIds);
  const isDone = (e: CalendarEntry) => e.status === "done" || local.has(e.id);
  const toMark = data.calendar
    .filter((e) => !isDone(e) && e.startsAt <= now && e.endsAt > now - FORGOTTEN_DAYS * DAY_MS)
    .sort((a, b) => b.startsAt - a.startsAt);
  const today = dayKey(new Date(now));
  const done = data.calendar.filter((e) => isDone(e) && dayKey(new Date(e.startsAt)) === today);
  const next = data.calendar.filter((e) => !isDone(e) && e.startsAt > now).sort((a, b) => a.startsAt - b.startsAt)[0] ?? null;
  return {
    main: toMark[0] ?? null,
    others: toMark.slice(1),
    doneToday: done.length
      ? { cents: done.reduce((sum, e) => sum + (e.doneCents ?? estimatePlannedShift(e, data.settings).plannedCents), 0) }
      : null,
    next,
  };
}


/** "18:30" + minutos → "23:30" (dá a volta à meia-noite). */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
