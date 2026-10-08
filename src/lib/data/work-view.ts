import "server-only";
import type { Dashboard } from "@/lib/finance/dashboard";
import type { ClockShift } from "@/lib/work/clock";
import { referenceDuration } from "@/lib/work/goal";
import { estimateShift, HOUR_MS } from "@/lib/work/shift";
import { computeWorkStats } from "@/lib/work/stats";
import type { WorkClientData } from "@/lib/work/view";
import type { Db } from "@/lib/supabase/server";
import type { Motorcycle } from "./motorcycles";
import { getAttributions, getShifts, getUpcomingScheduledShifts, getWorkSettings, type ShiftRecord } from "./work";

/** Último turno "acabado de terminar" mostrado no Início. */
const RECENT_MS = 12 * HOUR_MS;

export async function getWorkData(db: Db, now: Date) {
  const settings = await getWorkSettings(db);
  if (!settings) return null;
  const [shifts, attributions, upcoming] = await Promise.all([getShifts(db), getAttributions(db), getUpcomingScheduledShifts(db, now)]);
  const stats = computeWorkStats(
    shifts,
    attributions.map((a) => a.amountCents),
    now,
  );
  return { settings, shifts, attributions, upcoming, stats };
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
  const { settings, shifts, upcoming, stats } = work;
  const active = shifts.find((s) => s.endedAt == null) ?? null;
  const completed = shifts.filter((s) => s.endedAt != null);
  const last = completed[0];
  const recent =
    last && last.attributionId == null && now.getTime() - last.endedAt! < RECENT_MS ? estimateShift(last, last.endedAt!) : null;

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
    nextShift: upcoming[0] ?? null,
    recentCompleted: recent && last ? { id: last.id, endedAt: last.endedAt!, paidMs: recent.paidMs, plannedCents: recent.plannedCents } : null,
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
