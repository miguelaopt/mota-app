import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseIcon, ChevronRightIcon, SlidersIcon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Card, ListGroup, Section, StatRow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkClock } from "@/components/work/WorkClock";
import { requireSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";
import { signPhotoUrls } from "@/lib/data/photos";
import { buildWorkClientData, getWorkData } from "@/lib/data/work-view";
import { dayKey, formatMonthYear, formatShiftDay, formatShortDate, formatTime, toLocalInput } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { formatBp, formatHm, formatHoursCeil } from "@/lib/work/format";
import { equivalentShifts, hoursToGoal, referenceDuration, workForecast } from "@/lib/work/goal";
import { estimatePlannedShift, estimateShift, type GoalTarget } from "@/lib/work/shift";
import { TARGET_LABEL } from "@/lib/work/view";
import { ScheduledShifts, type ScheduledRow } from "./ScheduledShifts";

export const metadata: Metadata = { title: "Trabalho" };

export default async function WorkPage() {
  const { supabase, userId } = await requireSession();
  const now = new Date();
  const [work, { motorcycle, dashboard }] = await Promise.all([getWorkData(supabase, now), getDashboardData(supabase, now)]);
  const model = motorcycle?.model ?? "mota";

  if (!work) {
    return (
      <>
        <PageHeader title="Trabalho" />
        <Card className="p-5 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <BriefcaseIcon size={30} />
          </span>
          <p className="mt-4 text-xl font-bold">Transforma os teus turnos em progresso para a {model}</p>
          <p className="mt-2 text-muted">
            Pica a entrada e a saída, vê quanto cada turno te aproxima da mota e confirma a poupança quando ela acontecer.
          </p>
          <Link href="/trabalho/definicoes" className={buttonClass("primary", "lg", "mt-5 w-full")}>
            Configurar trabalho
          </Link>
          <p className="mt-3 text-xs text-muted">É um registo pessoal: nada é enviado ao empregador.</p>
        </Card>
      </>
    );
  }

  const photos = await signPhotoUrls(supabase, [motorcycle?.photoPath]);
  const photoUrl = motorcycle?.photoPath ? (photos[motorcycle.photoPath] ?? null) : null;
  const data = buildWorkClientData({ userId, now, work, motorcycle, photoUrl, dashboard });
  const { settings, stats, shifts, upcoming } = work;
  const completed = shifts.filter((s) => s.endedAt != null);
  const reference = referenceDuration(
    settings.referenceShiftMinutes,
    completed.map((s) => estimateShift(s, s.endedAt!).paidMs),
  );

  const scheduledRows: ScheduledRow[] = upcoming.map((s) => {
    const plan = estimatePlannedShift(s, settings);
    const [date, start] = toLocalInput(s.startsAt).split("T");
    return {
      id: s.id,
      title: `${formatShiftDay(s.startsAt, now)} · ${formatTime(s.startsAt)}–${formatTime(s.endsAt)}`,
      detail: `${formatHm(plan.paidMs)} pagas · ${formatEur(plan.plannedCents)} planeados para a mota`,
      date,
      start,
      end: toLocalInput(s.endsAt).split("T")[1],
      unpaidBreakMinutes: s.unpaidBreakMinutes,
    };
  });

  const targetRows: Array<{ target: GoalTarget; totalCents: number; missingCents: number }> = [
    { target: "minimum", totalCents: dashboard.minimum.totalCents, missingCents: dashboard.minimum.missingCents },
    { target: "full", totalCents: dashboard.full.totalCents, missingCents: dashboard.full.missingCents },
  ];
  const main = targetRows.find((t) => t.target === settings.target)!;
  const other = targetRows.find((t) => t.target !== settings.target)!;
  const mainHours = hoursToGoal(main.missingCents, settings.hourlyRateCents, settings.allocationBp);
  const otherHours = hoursToGoal(other.missingCents, settings.hourlyRateCents, settings.allocationBp);
  const forecast = workForecast({
    missingCents: main.missingCents,
    hourlyRateCents: settings.hourlyRateCents,
    allocationBp: settings.allocationBp,
    referencePaidMinutes: reference?.minutes ?? null,
    shiftsPerWeek: settings.shiftsPerWeek,
    now,
  });
  const hasGoal = main.totalCents > 0;

  return (
    <>
      <PageHeader
        title="Trabalho"
        subtitle={settings.jobName}
        action={
          <Link href="/trabalho/definicoes" aria-label="Definições do trabalho" className="mb-1 rounded-full bg-card p-2 text-accent active:opacity-60">
            <SlidersIcon size={20} />
          </Link>
        }
      />

      <WorkClock data={data} />

      <Section title="Para a mota">
        <Card className="space-y-3">
          {!hasGoal ? (
            <p className="text-muted">
              Define a{" "}
              <Link href="/mota" className="text-accent">
                mota
              </Link>{" "}
              e os preços para calcular quanto trabalho falta.
            </p>
          ) : mainHours.status === "reached" ? (
            <div>
              <p className="text-lg font-bold text-success">Atingiste o {TARGET_LABEL[settings.target]}! 0 horas em falta.</p>
              {settings.target === "minimum" && (
                <Link href="/trabalho/definicoes" className="mt-1 inline-block text-sm font-medium text-accent">
                  Escolher o setup completo como próxima meta
                </Link>
              )}
            </div>
          ) : mainHours.status === "no_contribution" ? (
            <p>
              <Link href="/trabalho/definicoes" className="font-medium text-accent">
                Define uma contribuição para calcular
              </Link>{" "}
              <span className="text-muted">(valor/hora e percentagem para a mota acima de zero).</span>
            </p>
          ) : (
            <>
              <p className="leading-snug">
                Faltam aproximadamente <span className="text-2xl font-bold tabular-nums">{formatHoursCeil(mainHours.hours)} horas pagas</span>{" "}
                para o {TARGET_LABEL[settings.target]}, se destinares {formatBp(settings.allocationBp)} ao objetivo.
              </p>
              {reference ? (
                <p className="text-sm text-muted tabular-nums">
                  ≈ {equivalentShifts(mainHours.hours, reference.minutes)} turnos de {formatHm(reference.minutes * 60_000)} pagas (
                  {reference.source === "settings" ? "duração de referência" : "média dos teus turnos"}).
                </p>
              ) : (
                <p className="text-sm text-muted">Define uma duração de referência para veres os turnos equivalentes.</p>
              )}
              <p className="text-sm text-muted tabular-nums">
                Calculado com o saldo real ({formatEur(dashboard.savedCents)}) e {formatEur(settings.hourlyRateCents)}/h. Não inclui outras
                entradas nem valorização dos investimentos.
              </p>
            </>
          )}
          {hasGoal && otherHours.status === "ok" && (
            <StatRow
              label={`Até ao ${TARGET_LABEL[other.target]}`}
              value={`≈ ${formatHoursCeil(otherHours.hours)} h`}
              hint={reference ? `≈ ${equivalentShifts(otherHours.hours, reference.minutes)} turnos` : undefined}
            />
          )}
          {hasGoal && mainHours.status === "ok" && (
            <div className="border-t border-sep pt-3 text-sm">
              {forecast ? (
                <p>
                  <span className="text-muted">Com {String(settings.shiftsPerWeek).replace(".", ",")} turnos/semana: </span>
                  <span className="font-semibold first-letter:uppercase">{formatMonthYear(forecast.date)}</span>
                  <span className="text-muted"> (aproximado, só com o trabalho)</span>
                </p>
              ) : (
                <p className="text-muted">
                  <Link href="/trabalho/definicoes" className="text-accent">
                    Indica quantos turnos fazes por semana
                  </Link>{" "}
                  para veres um mês aproximado.
                </p>
              )}
            </div>
          )}
        </Card>
      </Section>

      <Section title="Poupança do trabalho">
        <Card className="py-2">
          <StatRow
            label="Planeado por confirmar"
            hint={
              stats.pendingShiftIds.length > 0
                ? `${stats.pendingShiftIds.length} ${stats.pendingShiftIds.length === 1 ? "turno" : "turnos"}; ainda não está nas contas`
                : "nada por confirmar"
            }
            value={<span className="text-accent">{formatEur(stats.pendingPlannedCents)}</span>}
          />
          <StatRow label="Poupança confirmada" hint="dinheiro registado nas contas" value={<span className="text-success">{formatEur(stats.confirmedCents)}</span>} />
        </Card>
        {stats.pendingShiftIds.length > 0 && (
          <Link href="/trabalho/confirmar" className={buttonClass("secondary", "lg", "mt-3 w-full")}>
            Confirmar poupança
          </Link>
        )}
      </Section>

      <Section title="Próximos turnos">
        <ScheduledShifts rows={scheduledRows} today={dayKey(now)} />
      </Section>

      <Section title="Turnos registados">
        <Card className="py-2">
          <StatRow label="Este mês" value={stats.completedThisMonth} />
          <StatRow label="No total" value={stats.completedCount} />
          <StatRow label="Horas pagas registadas" value={formatHm(stats.paidMs)} />
          <StatRow label={settings.payMode === "monthly" ? "Equivalente de salário" : "Ganhos estimados"} value={formatEur(stats.earnedCents)} />
          <StatRow label="Planeado para a mota" value={formatEur(stats.plannedCents)} />
          {stats.longestPaidMs > 0 && <StatRow label="Turno mais longo" value={formatHm(stats.longestPaidMs)} />}
        </Card>
        {stats.paidMs > 0 && (
          <p className="mt-2 px-1 text-sm text-muted">
            Trabalhaste {formatHm(stats.paidMs)} por este objetivo (horas registadas na app).
          </p>
        )}
      </Section>

      {completed.length > 0 && (
        <Section title="Últimos turnos">
          <ListGroup>
            {completed.slice(0, 15).map((shift) => {
              const e = estimateShift(shift, shift.endedAt!);
              return (
                <Link
                  key={shift.id}
                  href={`/trabalho/turnos/${shift.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-card-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">
                      {formatShortDate(new Date(shift.startedAt), now)} · {formatTime(shift.startedAt)}–{formatTime(shift.endedAt!)}
                    </p>
                    <p className="text-sm text-muted tabular-nums">
                      {formatHm(e.paidMs)} pagas · {formatEur(e.plannedCents)} planeados
                    </p>
                  </div>
                  {shift.attributionId ? <Badge tone="success">Confirmado</Badge> : <Badge tone="accent">Por confirmar</Badge>}
                  <ChevronRightIcon size={18} className="shrink-0 text-muted" />
                </Link>
              );
            })}
          </ListGroup>
        </Section>
      )}

      <p className="mt-6 px-1 text-xs text-muted">
        Ganhos estimados ≠ planeado para a mota ≠ poupança real. Terminar um turno nunca altera o saldo das contas. Condições atuais:{" "}
        {formatEur(settings.hourlyRateCents)}/h, {formatBp(settings.allocationBp)} para a mota.
      </p>
    </>
  );
}
