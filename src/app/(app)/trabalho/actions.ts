"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth";
import { formatTime, fromLocalInput } from "@/lib/dates";
import { toCents } from "@/lib/finance/money";
import { FormError, getEnum, getId, getMoney, getOptionalMoney, getPercent, getRequiredText, getText } from "@/lib/forms";
import { check, runAction } from "@/lib/server-action";
import type { Db } from "@/lib/supabase/server";
import { clampToNow, parseWorkOp, type WorkOp } from "@/lib/work/clock";
import { HOUR_MS, MINUTE_MS, monthlyToHourlyCents, pctToBp, validateShiftTimes } from "@/lib/work/shift";

// ---------------------------------------------------------------------------
// Relógio de ponto (chamado pela fila offline do telemóvel)
// ---------------------------------------------------------------------------

/**
 * `retry: true` = falha temporária (rede, base de dados): o telemóvel guarda a
 * operação e volta a tentar. `retry: false` = a operação não é válida: o
 * telemóvel descarta-a e volta a ler o estado do servidor.
 */
export type WorkOpResult = { ok: true; at: number } | { ok: false; error: string; retry: boolean };

export async function workOpAction(input: unknown): Promise<WorkOpResult> {
  const op = parseWorkOp(input);
  if (!op) return { ok: false, error: "Pedido inválido.", retry: false };
  try {
    const { supabase } = await requireSession();
    await applyOnServer(supabase, op, Date.now());
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof FormError) return { ok: false, error: error.message, retry: false };
    console.error(error);
    return { ok: false, error: "Não foi possível sincronizar com o servidor.", retry: true };
  }
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}

const iso = (ms: number) => new Date(ms).toISOString();

async function findShift(db: Db, id: string) {
  const { data, error } = await db
    .from("shifts")
    .select("id, started_at, ended_at, planned_end_at, scheduled_shift_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function exists(db: Db, table: "scheduled_shifts" | "motorcycles", id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await db.from(table).select("id").eq("id", id).maybeSingle();
  return data?.id ?? null;
}

/** Saída mais tardia de outro turno que termina depois de `at` (para impedir sobreposições). */
async function overlappingEnd(db: Db, at: number, exceptId: string): Promise<number | null> {
  const { data, error } = await db
    .from("shifts")
    .select("ended_at")
    .neq("id", exceptId)
    .gt("ended_at", iso(at))
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.ended_at ? Date.parse(data.ended_at) : null;
}

async function applyOnServer(db: Db, op: WorkOp, serverNow: number): Promise<void> {
  if (op.type === "clock_in") {
    if (await findShift(db, op.shift.id)) return; // pedido repetido
    const s = op.shift;
    // Uma entrada antes da saída do turno anterior começa nessa saída (sem sobreposição).
    const requested = clampToNow(s.startedAt, serverNow);
    const startedAt = Math.max(requested, (await overlappingEnd(db, requested, s.id)) ?? requested);
    const { error } = await db.from("shifts").insert({
      id: s.id,
      started_at: iso(startedAt),
      planned_end_at: s.plannedEndAt != null && s.plannedEndAt > startedAt ? iso(s.plannedEndAt) : null,
      // A mota ou o turno planeado podem ter sido apagados enquanto estava offline.
      scheduled_shift_id: await exists(db, "scheduled_shifts", s.scheduledShiftId),
      motorcycle_id: await exists(db, "motorcycles", s.motorcycleId),
      pay_mode: s.payMode,
      hourly_rate_cents: s.hourlyRateCents,
      allocation_bp: s.allocationBp,
      target: s.target,
    });
    if (error?.code === "23505") throw new FormError("Já tens um turno a decorrer (talvez noutro dispositivo).");
    if (error) throw new Error(error.message);
    return;
  }

  const shift = await findShift(db, op.shiftId);
  if (!shift) throw new FormError("Turno não encontrado.");
  const startedAt = Date.parse(shift.started_at);

  switch (op.type) {
    case "break_start": {
      const { data: already } = await db.from("shift_breaks").select("id").eq("id", op.breakId).maybeSingle();
      if (already) return;
      if (shift.ended_at) throw new FormError("Este turno já terminou.");
      const at = Math.max(clampToNow(op.at, serverNow), startedAt);
      const { error } = await db
        .from("shift_breaks")
        .insert({ id: op.breakId, shift_id: op.shiftId, started_at: iso(at), paid: op.paid });
      if (error?.code === "23505") throw new FormError("Já estás em pausa.");
      if (error) throw new Error(error.message);
      return;
    }
    case "break_end": {
      const { data: pause, error } = await db.from("shift_breaks").select("started_at, ended_at").eq("id", op.breakId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!pause) throw new FormError("Pausa não encontrada.");
      if (pause.ended_at) return;
      const at = Math.max(clampToNow(op.at, serverNow), Date.parse(pause.started_at));
      check(await db.from("shift_breaks").update({ ended_at: iso(at) }).eq("id", op.breakId).is("ended_at", null));
      return;
    }
    case "clock_out": {
      if (shift.ended_at) return; // já picou saída
      const { data: pauses, error } = await db.from("shift_breaks").select("started_at").eq("shift_id", op.shiftId);
      if (error) throw new Error(error.message);
      const lastBreakStart = Math.max(startedAt, ...pauses.map((p) => Date.parse(p.started_at)));
      const endedAt = Math.max(clampToNow(op.at, serverNow), lastBreakStart, startedAt + 1000);
      check(await db.from("shift_breaks").update({ ended_at: iso(endedAt) }).eq("shift_id", op.shiftId).is("ended_at", null));
      check(await db.from("shifts").update({ ended_at: iso(endedAt) }).eq("id", op.shiftId).is("ended_at", null));
      if (shift.scheduled_shift_id) {
        check(await db.from("scheduled_shifts").update({ status: "done" }).eq("id", shift.scheduled_shift_id));
      }
      return;
    }
    case "set_start": {
      if (shift.ended_at) throw new FormError("Este turno já terminou: corrige o horário no resumo do turno.");
      const at = clampToNow(op.at, serverNow);
      const previousEnd = await overlappingEnd(db, at, op.shiftId);
      if (previousEnd != null) {
        throw new FormError(`A entrada não pode ser antes da saída do turno anterior (${formatTime(previousEnd)}).`);
      }
      const { data: pauses, error } = await db.from("shift_breaks").select("started_at").eq("shift_id", op.shiftId);
      if (error) throw new Error(error.message);
      if (pauses.some((p) => Date.parse(p.started_at) < at)) throw new FormError("A entrada tem de ser antes da primeira pausa.");
      if (shift.planned_end_at && Date.parse(shift.planned_end_at) <= at) {
        throw new FormError("A entrada tem de ser antes da saída prevista.");
      }
      check(await db.from("shifts").update({ started_at: iso(at) }).eq("id", op.shiftId));
      return;
    }
    case "set_planned_end": {
      if (shift.ended_at) return;
      if (op.at != null && op.at <= startedAt) throw new FormError("A saída prevista tem de ser depois da entrada.");
      check(await db.from("shifts").update({ planned_end_at: op.at == null ? null : iso(op.at) }).eq("id", op.shiftId));
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const PAY_MODES = ["hourly", "monthly"] as const;
const TARGETS = ["minimum", "full"] as const;

/** Número positivo opcional com vírgula decimal ("4,5"). */
function getOptionalNumber(form: FormData, name: string, { label, min, max }: { label: string; min: number; max: number }): number | null {
  const raw = String(form.get(name) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new FormError(`"${label}" tem de estar entre ${String(min).replace(".", ",")} e ${max}.`);
  }
  return value;
}

export async function saveWorkSettingsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, userId }) => {
    const payMode = getEnum(form, "pay_mode", PAY_MODES, "hourly");
    let hourlyRateCents: number;
    let monthlySalaryCents: number | null = null;
    let monthlyHours: number | null = null;

    if (payMode === "monthly") {
      monthlySalaryCents = toCents(getMoney(form, "monthly_salary", { label: "Salário líquido mensal", required: true }));
      monthlyHours = getOptionalNumber(form, "monthly_hours", { label: "Horas por mês", min: 1, max: 744 });
      if (monthlyHours == null) throw new FormError('Preenche o campo "Horas por mês".');
      const typed = getOptionalMoney(form, "hourly_rate", { label: "Valor/hora usado" });
      hourlyRateCents = typed != null ? toCents(typed) : monthlyToHourlyCents(monthlySalaryCents, monthlyHours);
    } else {
      hourlyRateCents = toCents(getMoney(form, "hourly_rate", { label: "Valor líquido por hora", required: true }));
    }
    if (hourlyRateCents > 100000) throw new FormError("O valor/hora é demasiado alto.");

    const referenceHours = getOptionalNumber(form, "reference_hours", { label: "Duração de referência", min: 0.25, max: 24 });

    check(
      await supabase.from("work_settings").upsert({
        user_id: userId,
        job_name: getRequiredText(form, "job_name", { label: "Trabalho", max: 60 }),
        pay_mode: payMode,
        hourly_rate_cents: hourlyRateCents,
        monthly_salary_cents: monthlySalaryCents,
        monthly_hours: monthlyHours,
        allocation_bp: pctToBp(getPercent(form, "allocation_pct", { label: "Percentagem para a mota", fallback: 100 })),
        target: getEnum(form, "target", TARGETS, "minimum"),
        paid_breaks: form.get("paid_breaks") === "paid",
        reference_shift_minutes: referenceHours == null ? null : Math.round(referenceHours * 60),
        shifts_per_week: getOptionalNumber(form, "shifts_per_week", { label: "Turnos por semana", min: 0.5, max: 21 }),
        haptics: form.get("haptics") === "on",
        animations: form.get("animations") === "on",
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Próximo turno (planeado à mão)
// ---------------------------------------------------------------------------

function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function saveScheduledShiftAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const date = String(form.get("date") ?? "");
    const startTime = String(form.get("start") ?? "");
    const endTime = String(form.get("end") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new FormError("Escolhe o dia do turno.");
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) throw new FormError("Indica a hora de entrada e de saída.");

    const startsAt = fromLocalInput(`${date}T${startTime}`);
    // Saída igual ou antes da entrada = sai no dia seguinte.
    const endsAt = fromLocalInput(`${endTime > startTime ? date : nextDay(date)}T${endTime}`);
    if (!startsAt || !endsAt) throw new FormError("Data ou hora inválida.");
    if (endsAt.getTime() - startsAt.getTime() > 24 * HOUR_MS) throw new FormError("Um turno não pode durar mais de 24 horas.");

    const unpaid = getOptionalMinutes(form, "unpaid_break_minutes");
    if (unpaid * MINUTE_MS >= endsAt.getTime() - startsAt.getTime()) throw new FormError("A pausa não paga é maior do que o turno.");

    const fields = {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      unpaid_break_minutes: unpaid,
      notes: getText(form, "notes", { label: "Notas", max: 500 }),
    };

    if (form.get("id")) {
      check(await supabase.from("scheduled_shifts").update(fields).eq("id", getId(form)));
    } else {
      check(await supabase.from("scheduled_shifts").insert(fields));
    }
  });
}

function getOptionalMinutes(form: FormData, name: string): number {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 720) throw new FormError("A pausa tem de ser um número de minutos entre 0 e 720.");
  return value;
}

export async function deleteScheduledShiftAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("scheduled_shifts").delete().eq("id", getId(form)));
  });
}

// ---------------------------------------------------------------------------
// Corrigir ou apagar turnos terminados
// ---------------------------------------------------------------------------

function getInstant(form: FormData, name: string, label: string): number {
  const date = fromLocalInput(String(form.get(name) ?? ""));
  if (!date) throw new FormError(`Indica ${label}.`);
  return date.getTime();
}

/** Corrige entrada/saída. A estimativa muda; poupança já confirmada não. */
export async function updateShiftAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const id = getId(form);
    const startedAt = getInstant(form, "started_at", "a hora de entrada");
    const endedAt = getInstant(form, "ended_at", "a hora de saída");
    if (endedAt > Date.now() + MINUTE_MS) throw new FormError("A saída não pode ser no futuro.");

    const { data: shift } = await supabase.from("shifts").select("ended_at").eq("id", id).maybeSingle();
    if (!shift) throw new FormError("Turno não encontrado.");
    if (!shift.ended_at) throw new FormError("Este turno ainda está a decorrer.");

    const { data: pauses, error } = await supabase.from("shift_breaks").select("started_at, ended_at").eq("shift_id", id);
    if (error) throw new Error(error.message);
    const problem = validateShiftTimes({
      startedAt,
      endedAt,
      breaks: pauses.map((p) => ({ startedAt: Date.parse(p.started_at), endedAt: p.ended_at ? Date.parse(p.ended_at) : null })),
    });
    if (problem) throw new FormError(problem);

    const { data: overlap, error: overlapError } = await supabase
      .from("shifts")
      .select("id")
      .neq("id", id)
      .lt("started_at", iso(endedAt))
      .or(`ended_at.is.null,ended_at.gt.${iso(startedAt)}`)
      .limit(1);
    if (overlapError) throw new Error(overlapError.message);
    if (overlap.length > 0) throw new FormError("Este horário sobrepõe-se a outro turno.");

    check(await supabase.from("shifts").update({ started_at: iso(startedAt), ended_at: iso(endedAt) }).eq("id", id));
  });
}

export async function deleteBreakAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const id = getId(form);
    const { data: pause } = await supabase.from("shift_breaks").select("shift_id, ended_at").eq("id", id).maybeSingle();
    if (!pause) return;
    if (!pause.ended_at) throw new FormError("Termina a pausa antes de a apagar.");
    check(await supabase.from("shift_breaks").delete().eq("id", id));
  });
}

export async function deleteShiftAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const id = getId(form);
    const { data: link } = await supabase.from("savings_attribution_shifts").select("attribution_id").eq("shift_id", id).maybeSingle();
    if (link) throw new FormError("Este turno faz parte de uma poupança confirmada. Anula essa confirmação primeiro.");
    const { data: shift } = await supabase.from("shifts").select("ended_at").eq("id", id).maybeSingle();
    if (shift && !shift.ended_at) throw new FormError("Pica a saída antes de apagar o turno.");
    check(await supabase.from("shifts").delete().eq("id", id));
  });
}

// ---------------------------------------------------------------------------
// Confirmar poupança (liga-se a uma atualização de saldo real)
// ---------------------------------------------------------------------------

export async function confirmSavingsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const id = getId(form, "attribution_id");
    const accountId = getId(form, "account_id");
    const amountCents = toCents(getMoney(form, "amount", { label: "Quanto guardaste", required: true }));
    if (amountCents <= 0) throw new FormError("Indica quanto guardaste.");
    const mode = getEnum(form, "mode", ["update", "existing"] as const, "update");

    let newBalance: number | null = null;
    let snapshotId: number | null = null;
    if (mode === "update") {
      newBalance = getMoney(form, "new_balance", { label: "Novo saldo da conta", required: true, allowNegative: true });
    } else {
      snapshotId = Number(form.get("snapshot_id"));
      if (!Number.isSafeInteger(snapshotId) || snapshotId <= 0) throw new FormError("Escolhe a atualização de saldo onde entrou este dinheiro.");
    }

    const shiftIds = form.getAll("shift_ids").map(String);
    if (shiftIds.some((s) => !/^[0-9a-f-]{36}$/i.test(s))) throw new FormError("Pedido inválido.");

    const { error } = await supabase.rpc("confirm_work_savings", {
      p_id: id,
      p_account_id: accountId,
      p_amount_cents: amountCents,
      p_new_balance: newBalance,
      p_snapshot_id: snapshotId,
      p_shift_ids: shiftIds,
      p_notes: getText(form, "notes", { label: "Notas", max: 500 }),
    });
    // Mensagens das validações da função (raise exception) vêm com o código P0001.
    if (error?.code === "P0001") throw new FormError(error.message);
    if (error) throw new Error(error.message);
  });
}

/** Anula uma confirmação: os turnos voltam a "por confirmar"; o saldo da conta não muda. */
export async function deleteAttributionAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    check(await supabase.from("savings_attributions").delete().eq("id", getId(form)));
  });
}
