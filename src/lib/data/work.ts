import "server-only";
import type { Cents } from "@/lib/finance/money";
import type { Db } from "@/lib/supabase/server";
import type { GoalTarget, PayMode, ShiftBreak } from "@/lib/work/shift";

export interface WorkSettings {
  jobName: string;
  payMode: PayMode;
  hourlyRateCents: Cents;
  monthlySalaryCents: Cents | null;
  monthlyHours: number | null;
  allocationBp: number;
  target: GoalTarget;
  paidBreaks: boolean;
  referenceShiftMinutes: number | null;
  shiftsPerWeek: number | null;
  timeZone: string;
  haptics: boolean;
  animations: boolean;
}

export async function getWorkSettings(db: Db): Promise<WorkSettings | null> {
  const { data, error } = await db
    .from("work_settings")
    .select(
      "job_name, pay_mode, hourly_rate_cents, monthly_salary_cents, monthly_hours, allocation_bp, target, paid_breaks, reference_shift_minutes, shifts_per_week, time_zone, haptics, animations",
    )
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    jobName: data.job_name,
    payMode: data.pay_mode,
    hourlyRateCents: data.hourly_rate_cents,
    monthlySalaryCents: data.monthly_salary_cents,
    monthlyHours: data.monthly_hours == null ? null : Number(data.monthly_hours),
    allocationBp: data.allocation_bp,
    target: data.target,
    paidBreaks: data.paid_breaks,
    referenceShiftMinutes: data.reference_shift_minutes,
    shiftsPerWeek: data.shifts_per_week == null ? null : Number(data.shifts_per_week),
    timeZone: data.time_zone,
    haptics: data.haptics,
    animations: data.animations,
  };
}

/** Turno com instantes em milissegundos (como os cálculos de lib/work). */
export interface ShiftRecord {
  id: string;
  motorcycleId: string | null;
  scheduledShiftId: string | null;
  startedAt: number;
  endedAt: number | null;
  plannedEndAt: number | null;
  payMode: PayMode;
  hourlyRateCents: Cents;
  allocationBp: number;
  target: GoalTarget;
  version: number;
  editedAt: number | null;
  originalStartedAt: number | null;
  originalEndedAt: number | null;
  breaks: ShiftBreak[];
  /** Confirmação de poupança que reconciliou este turno. */
  attributionId: string | null;
}

const ms = (value: string | null) => (value == null ? null : Date.parse(value));

const PAGE_SIZE = 1000;

async function allPages<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetch(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

const SHIFT_COLUMNS =
  "id, motorcycle_id, scheduled_shift_id, started_at, ended_at, planned_end_at, pay_mode, hourly_rate_cents, allocation_bp, target, version, edited_at, original_started_at, original_ended_at";

type ShiftRow = {
  id: string;
  motorcycle_id: string | null;
  scheduled_shift_id: string | null;
  started_at: string;
  ended_at: string | null;
  planned_end_at: string | null;
  pay_mode: PayMode;
  hourly_rate_cents: number;
  allocation_bp: number;
  target: GoalTarget;
  version: number;
  edited_at: string | null;
  original_started_at: string | null;
  original_ended_at: string | null;
};

async function hydrate(db: Db, rows: ShiftRow[]): Promise<ShiftRecord[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  // Em lotes, para o URL do pedido não ficar enorme.
  const breaks: Array<{ id: string; shift_id: string; started_at: string; ended_at: string | null; paid: boolean }> = [];
  const links: Array<{ shift_id: string; attribution_id: string }> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [b, l] = await Promise.all([
      db.from("shift_breaks").select("id, shift_id, started_at, ended_at, paid").in("shift_id", chunk).order("started_at"),
      db.from("savings_attribution_shifts").select("shift_id, attribution_id").in("shift_id", chunk),
    ]);
    if (b.error) throw new Error(b.error.message);
    if (l.error) throw new Error(l.error.message);
    breaks.push(...b.data);
    links.push(...l.data);
  }

  const breaksByShift = new Map<string, ShiftBreak[]>();
  for (const b of breaks) {
    const list = breaksByShift.get(b.shift_id) ?? [];
    list.push({ id: b.id, startedAt: Date.parse(b.started_at), endedAt: ms(b.ended_at), paid: b.paid });
    breaksByShift.set(b.shift_id, list);
  }
  const attributionByShift = new Map(links.map((l) => [l.shift_id, l.attribution_id]));

  return rows.map((row) => ({
    id: row.id,
    motorcycleId: row.motorcycle_id,
    scheduledShiftId: row.scheduled_shift_id,
    startedAt: Date.parse(row.started_at),
    endedAt: ms(row.ended_at),
    plannedEndAt: ms(row.planned_end_at),
    payMode: row.pay_mode,
    hourlyRateCents: row.hourly_rate_cents,
    allocationBp: row.allocation_bp,
    target: row.target,
    version: row.version,
    editedAt: ms(row.edited_at),
    originalStartedAt: ms(row.original_started_at),
    originalEndedAt: ms(row.original_ended_at),
    breaks: breaksByShift.get(row.id) ?? [],
    attributionId: attributionByShift.get(row.id) ?? null,
  }));
}

/** Todos os turnos, do mais recente para o mais antigo. */
export async function getShifts(db: Db): Promise<ShiftRecord[]> {
  const rows = await allPages<ShiftRow>((from, to) =>
    db.from("shifts").select(SHIFT_COLUMNS).order("started_at", { ascending: false }).range(from, to),
  );
  return hydrate(db, rows);
}

export async function getShift(db: Db, id: string): Promise<ShiftRecord | null> {
  const { data, error } = await db.from("shifts").select(SHIFT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (await hydrate(db, [data]))[0];
}

export interface ScheduledShift {
  id: string;
  startsAt: number;
  endsAt: number;
  unpaidBreakMinutes: number;
  notes: string | null;
}

/** Turnos planeados que ainda não terminaram, por ordem. */
export async function getUpcomingScheduledShifts(db: Db, now: Date): Promise<ScheduledShift[]> {
  const { data, error } = await db
    .from("scheduled_shifts")
    .select("id, starts_at, ends_at, unpaid_break_minutes, notes")
    .eq("status", "planned")
    .gt("ends_at", now.toISOString())
    .order("starts_at")
    .limit(20);
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    startsAt: Date.parse(row.starts_at),
    endsAt: Date.parse(row.ends_at),
    unpaidBreakMinutes: row.unpaid_break_minutes,
    notes: row.notes,
  }));
}

export interface SavingsAttribution {
  id: string;
  accountId: string;
  snapshotId: number | null;
  amountCents: Cents;
  notes: string | null;
  confirmedAt: number;
  shiftIds: string[];
}

export async function getAttributions(db: Db): Promise<SavingsAttribution[]> {
  const [rows, links] = await Promise.all([
    allPages<{ id: string; account_id: string; snapshot_id: number | null; amount_cents: number; notes: string | null; confirmed_at: string }>(
      (from, to) =>
        db
          .from("savings_attributions")
          .select("id, account_id, snapshot_id, amount_cents, notes, confirmed_at")
          .order("confirmed_at", { ascending: false })
          .range(from, to),
    ),
    allPages<{ attribution_id: string; shift_id: string }>((from, to) =>
      db.from("savings_attribution_shifts").select("attribution_id, shift_id").range(from, to),
    ),
  ]);
  const shiftsByAttribution = new Map<string, string[]>();
  for (const link of links) {
    const list = shiftsByAttribution.get(link.attribution_id) ?? [];
    list.push(link.shift_id);
    shiftsByAttribution.set(link.attribution_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    snapshotId: row.snapshot_id,
    amountCents: row.amount_cents,
    notes: row.notes,
    confirmedAt: Date.parse(row.confirmed_at),
    shiftIds: shiftsByAttribution.get(row.id) ?? [],
  }));
}
