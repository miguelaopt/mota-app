import "server-only";
import { toLocalInput } from "@/lib/dates";
import type { Dashboard } from "@/lib/finance/dashboard";
import { DAY_MS } from "@/lib/finance/history";
import type { ClockShift } from "@/lib/work/clock";
import { referenceDuration } from "@/lib/work/goal";
import { estimateShift } from "@/lib/work/shift";
import { computeWorkStats } from "@/lib/work/stats";
import type { WorkClientData } from "@/lib/work/view";
import type { Db } from "@/lib/supabase/server";
import type { Motorcycle } from "./motorcycles";
import { getAttributions, getCalendarShifts, getShifts, getUpcomingScheduledShifts, getWorkSettings, type ShiftRecord } from "./work";

export async function getWorkData(db: Db, now: Date) {
  const settings = await getWorkSettings(db);
  if (!settings) return null;
  const [shifts, attributions, upcoming, calendar] = await Promise.all([
    getShifts(db),
    getAttributions(db),
    getUpcomingScheduledShifts(db, now),
    getCalendarShifts(db, new Date(now.getTime() - 62 * DAY_MS), new Date(now.getTime() + 124 * DAY_MS)),
  ]);
  const stats = computeWorkStats(
    shifts,
    attributions.map((a) => a.amountCents),
    now,
  );
  return { settings, shifts, attributions, upcoming, calendar, stats };
}

export type WorkData = NonNullable<Awaited<ReturnType<typeof getWorkData>>>;

export function toClockShift(shift: ShiftRecord): ClockShift {
  return {
    id: shift.id,
    startedAt: shift.startedAt,
    plannedEndAt: shift.plannedEndAt,
    scheduledShiftId: shift.scheduledShiftId,
    motorcycleId: shift.motorcycleId,
    payMode: shift.payMode,
    hourlyRateCents: shift.hourlyRateCents,
    allocationBp: shift.allocationBp,
    target: shift.target,
    breaks: shift.breaks,
  };
}

export function buildWorkClientData({
  userId,
  now,
  work,
  motorcycle,
  photoUrl,
  dashboard,
}: {
  userId: string;
  now: Date;
  work: WorkData;
  motorcycle: Motorcycle | null;
  photoUrl: string | null;
  dashboard: Dashboard;
}): WorkClientData {
  const { settings, shifts, upcoming, calendar, stats } = work;
  const byScheduled = new Map(shifts.filter((s) => s.scheduledShiftId && s.endedAt != null).map((s) => [s.scheduledShiftId!, s]));
  const active = shifts.find((s) => s.endedAt == null) ?? null;
  const completed = shifts.filter((s) => s.endedAt != null);

  return {
    userId,
    renderedAt: now.getTime(),
    settings: {
      jobName: settings.jobName,
      payMode: settings.payMode,
      hourlyRateCents: settings.hourlyRateCents,
      allocationBp: settings.allocationBp,
      target: settings.target,
      paidBreaks: settings.paidBreaks,
      haptics: settings.haptics,
      animations: settings.animations,
    },
    activeShift: active ? toClockShift(active) : null,
    calendar: calendar.map((c) => {
      // Ligado pelo "Turno feito" ou, para turnos registados de outra forma, pelo horário.
      const done =
        byScheduled.get(c.id) ??
        completed.find((s) => s.scheduledShiftId == null && s.startedAt < c.endsAt && s.endedAt! > c.startsAt);
      return {
        id: c.id,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        unpaidBreakMinutes: c.unpaidBreakMinutes,
        status: c.status === "done" || done ? "done" : "planned",
        shiftId: done?.id ?? null,
        doneCents: done ? estimateShift(done, done.endedAt!).plannedCents : null,
      };
    }),
    defaultShiftMinutes: settings.referenceShiftMinutes ?? 300,
    lastStartTime: calendar.length > 0 ? toLocalInput(calendar[calendar.length - 1].startsAt).slice(11) : null,
    nextShift: upcoming[0] ?? null,
    motorcycle: motorcycle ? { id: motorcycle.id, model: motorcycle.model, photoUrl } : null,
    goal: {
      savedCents: dashboard.savedCents,
      minimumCents: dashboard.minimum.totalCents,
      fullCents: dashboard.full.totalCents,
    },
    pendingPlannedCents: stats.pendingPlannedCents,
    completedForGoal: completed.filter((s) => motorcycle == null || s.motorcycleId === motorcycle.id).length,
    referenceMinutes:
      referenceDuration(
        settings.referenceShiftMinutes,
        completed.map((s) => estimateShift(s, s.endedAt!).paidMs),
      )?.minutes ?? null,
  };
}
