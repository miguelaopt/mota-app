import { randomUUID } from "node:crypto";
import Link from "next/link";
import { CheckIcon, ChevronRightIcon, SlidersIcon } from "@/components/icons";
import { Card, ListGroup, Section, StatRow } from "@/components/ui/Card";
import { PROJECTION_STRIPES, ProgressBar } from "@/components/ui/ProgressBar";
import { ReceivePaymentBanner } from "@/components/work/ReceivePaymentBanner";
import { WorkHomeCard, WorkProjectionLine } from "@/components/work/WorkHomeCard";
import { requireSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getDashboardData } from "@/lib/data/dashboard";
import { signPhotoUrls } from "@/lib/data/photos";
import { buildWorkClientData, getWorkData } from "@/lib/data/work-view";
import { formatDuration, formatMonthYear } from "@/lib/dates";
import type { TargetStatus } from "@/lib/finance/dashboard";
import type { Forecast } from "@/lib/finance/forecast";
import { formatEur, formatPct } from "@/lib/finance/money";
import { buildConfirmData } from "@/lib/work/confirm";

/** Ritmo arredondado ao euro: "≈ 494 €/mês". */
function perMonth(cents: number) {
  return `${formatEur(Math.round(cents / 100) * 100, { hideZeroCents: true })}/mês`;
}

function forecastLabel(forecast: Forecast): { date: string; detail: string } {
  switch (forecast.source) {
    case "reached":
      return { date: "Já tens!", detail: "Tens o suficiente para esta meta." };
    case "history":
      return {
        date: formatMonthYear(forecast.date!),
        detail: `${formatDuration(forecast.months!)}, ao ritmo atual (${perMonth(forecast.centsPerMonth!)})`,
      };
    case "monthly_goal":
      return {
        date: formatMonthYear(forecast.date!),
        detail: `${formatDuration(forecast.months!)}, com a meta de ${perMonth(forecast.centsPerMonth!)}`,
      };
    default:
      return { date: "—", detail: "Define uma meta mensal para veres a data prevista." };
  }
}

function TargetCard({ title, target }: { title: string; target: TargetStatus }) {
  const forecast = forecastLabel(target.forecast);
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <p className="eyebrow">{title}</p>
      <p className="display text-[1.75rem]">{formatEur(target.totalCents, { hideZeroCents: true })}</p>
      <ProgressBar pct={target.pct} size="sm" tone={target.reached ? "success" : "accent"} label={`${title}: ${formatPct(target.pct)}`} />
      <p className="text-sm tabular-nums">
        {target.reached ? (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <CheckIcon size={15} strokeWidth={2.6} /> Atingido
          </span>
        ) : (
          <>
            <span className="text-muted">Falta </span>
            <span className="font-medium">{formatEur(target.missingCents, { hideZeroCents: true })}</span>
          </>
        )}
      </p>
      {!target.reached && <p className="text-sm text-muted first-letter:uppercase">{forecast.date}</p>}
    </Card>
  );
}

export default async function HomePage() {
  const { supabase, userId } = await requireSession();
  const now = new Date();
  const [{ motorcycle, settings, accounts, snapshots, dashboard: d, unpricedGear, unpricedCosts }, work] = await Promise.all([
    getDashboardData(supabase, now),
    getWorkData(supabase, now),
  ]);
  const photos = await signPhotoUrls(supabase, [motorcycle?.photoPath]);
  const photoUrl = motorcycle?.photoPath ? photos[motorcycle.photoPath] : undefined;
  const workData = work ? buildWorkClientData({ userId, now, work, motorcycle, photoUrl: photoUrl ?? null, dashboard: d }) : null;
  // Projeção (tracejada na barra): planeado em turnos concluídos e ainda não confirmado.
  const projectedPct =
    workData && d.full.totalCents > 0 ? ((d.savedCents + workData.pendingPlannedCents) / d.full.totalCents) * 100 : undefined;
  const confirm = work ? buildConfirmData({ shifts: work.shifts, accounts, snapshots, attributions: work.attributions, now }) : null;
  const fullForecast = forecastLabel(d.full.forecast);
  const showProjection = projectedPct != null && projectedPct > d.full.pct + 0.05;
  const hasGoal = d.full.totalCents > 0;

  const setup = [
    { done: Boolean(motorcycle), label: "Escolhe a mota e o preço", href: "/mota" },
    { done: d.accounts.missingBalanceCount === 0, label: "Define o saldo das contas", href: "/contas" },
    { done: unpricedGear === 0, label: "Põe preço no equipamento", href: "/equipamento" },
    { done: unpricedCosts === 0, label: "Preenche os custos da compra", href: "/custos" },
    { done: settings.monthlyGoalCents > 0 || d.rate != null, label: "Define uma meta mensal", href: "/definicoes" },
  ];
  const pending = setup.filter((s) => !s.done);

  return (
    <>
      {/* Herói: a mota em estúdio (a foto escolhida ou a ilustração da Z400) */}
      <div className="relative -mx-4 -mt-[calc(var(--safe-top)+0.75rem)] h-[calc(var(--safe-top)+21rem)] overflow-x-clip">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_60%_30%,#1d2125_0%,#0e1012_60%,#0b0c0e_100%)]" />
        {photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={motorcycle?.model ?? ""} className="absolute inset-0 h-full w-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-bg/80 via-bg/10 to-bg" />
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/illustrations/z400.webp"
            alt=""
            width={924}
            height={540}
            className="absolute left-1/2 top-[calc(var(--safe-top)+5.5rem)] w-[min(100%,27rem)] max-w-none -translate-x-1/2"
          />
        )}
        <div className="relative z-10 flex items-start justify-between gap-3 px-5 pt-[calc(var(--safe-top)+1.25rem)]">
          <Link href="/mota" className="min-w-0 active:opacity-70">
            {motorcycle ? (
              <>
                <p className="eyebrow">A tua próxima mota</p>
                <p className="display mt-1 truncate text-[2.125rem] leading-[1.05]">{motorcycle.model}</p>
                <p className="mt-0.5 text-sm text-muted tabular-nums">{formatEur(motorcycle.priceCents, { hideZeroCents: true })}</p>
              </>
            ) : (
              <>
                <p className="eyebrow">Ainda sem mota</p>
                <p className="display mt-1 text-[2.125rem] leading-[1.05]">Qual é a mota?</p>
                <p className="mt-0.5 text-sm text-muted">Toca para escolheres o modelo e o preço.</p>
              </>
            )}
          </Link>
          <Link
            href="/definicoes"
            aria-label="Definições"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-fg backdrop-blur-xl active:opacity-70"
          >
            <SlidersIcon size={20} />
          </Link>
        </div>
      </div>

      {/* Progresso principal, em vidro por cima da mota */}
      <div className="relative z-10 -mt-9 space-y-3">
        {hasGoal ? (
          <Card className="p-[1.125rem]">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">Já juntaste</p>
                <p className="display mt-1 text-[clamp(2.25rem,12.5vw,3.125rem)] leading-[0.95]">{formatEur(d.savedCents)}</p>
                <p className="mt-1 text-[0.8125rem] text-muted tabular-nums">
                  de {formatEur(d.full.totalCents, { hideZeroCents: true })} · setup completo
                </p>
              </div>
              <p
                className={cn("display glow-text text-[3.25rem] font-bold leading-[0.95]", d.full.reached ? "text-success" : "text-accent")}
              >
                {formatPct(d.full.pct)}
              </p>
            </div>

            <ProgressBar
              className="mt-4"
              pct={d.full.pct}
              projectedPct={projectedPct}
              markPct={d.minimumMarkPct}
              tone={d.full.reached ? "success" : "accent"}
              label={`Progresso: ${formatPct(d.full.pct)}`}
            />
            <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted tabular-nums">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
                guardado
              </span>
              {showProjection && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: PROJECTION_STRIPES }} aria-hidden />
                  por confirmar
                </span>
              )}
              {d.minimumMarkPct > 0 && d.minimumMarkPct < 100 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-0.5 rounded-full bg-fg/70" aria-hidden />
                  mínimo {formatEur(d.minimum.totalCents, { hideZeroCents: true })}
                </span>
              )}
            </div>
            {workData && <WorkProjectionLine data={workData} />}

            {d.full.reached ? (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-accent-line bg-success-soft px-4 py-3 font-semibold text-success">
                <CheckIcon size={18} strokeWidth={2.6} /> Meta atingida. Está na hora de ir buscar a mota.
              </p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-sep pt-4">
                  <div>
                    <p className="text-xs text-muted">Falta</p>
                    <p className="display mt-1 text-[1.75rem]">{formatEur(d.full.missingCents, { hideZeroCents: true })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Previsão</p>
                    <p className="display mt-1 text-[1.75rem] first-letter:uppercase">{fullForecast.date.replace(" de ", " ")}</p>
                  </div>
                </div>
                <p className="mt-2 text-[0.8125rem] text-muted">
                  {d.full.forecast.source === "none" ? (
                    <Link href="/definicoes" className="text-accent">
                      {fullForecast.detail}
                    </Link>
                  ) : (
                    fullForecast.detail
                  )}
                </p>
              </>
            )}
          </Card>
        ) : (
          <Card className="p-[1.125rem]">
            <p className="eyebrow">Já juntaste</p>
            <p className="display mt-1 text-[clamp(2.25rem,12.5vw,3.125rem)] leading-[0.95]">{formatEur(d.savedCents)}</p>
            <p className="mt-3 text-sm text-muted">
              Ainda não há meta. Escolhe a mota e põe os preços do equipamento e dos custos para veres quanto falta.
            </p>
          </Card>
        )}

        {confirm && <ReceivePaymentBanner data={confirm} attributionId={randomUUID()} renderedAt={now.getTime()} />}
      </div>

      {/* Trabalho: próximo turno, turno ativo ou resumo do último */}
      <WorkHomeCard data={workData} model={motorcycle?.model ?? "mota"} />

      {/* Mínimo vs completo */}
      {hasGoal && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <TargetCard title="Mínimo para andar" target={d.minimum} />
          <TargetCard title="Setup completo" target={d.full} />
        </div>
      )}

      {pending.length > 0 && (
        <Section title="Para a meta ficar certa">
          <ListGroup>
            {setup.map((step) => (
              <Link key={step.href} href={step.href} className="flex min-h-12 items-center gap-3 px-4 py-3 active:bg-card-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                    step.done ? "border-accent bg-accent text-accent-fg" : "border-white/15",
                  )}
                >
                  {step.done && <CheckIcon size={14} strokeWidth={3} />}
                </span>
                <span className={cn("flex-1", step.done && "text-muted line-through decoration-1")}>{step.label}</span>
                {!step.done && <ChevronRightIcon size={18} className="text-muted" />}
              </Link>
            ))}
          </ListGroup>
        </Section>
      )}

      <Section title="Ritmo de poupança">
        <Card className="py-2">
          {d.rate ? (
            <StatRow
              label="Média real"
              hint={`últimos ${Math.round(d.rate.days)} dias de histórico`}
              value={
                <span className={cn("font-semibold", d.rate.centsPerMonth < 0 && "text-danger")}>{perMonth(d.rate.centsPerMonth)}</span>
              }
            />
          ) : (
            <StatRow label="Média real" hint="precisa de pelo menos 30 dias de histórico" value={<span className="text-muted">—</span>} />
          )}
          <StatRow
            label={
              <Link href="/definicoes" className="text-accent">
                Meta mensal
              </Link>
            }
            value={settings.monthlyGoalCents > 0 ? perMonth(settings.monthlyGoalCents) : <span className="text-muted">por definir</span>}
          />
        </Card>
      </Section>

      <Section title="O que entra na meta">
        <Card className="py-2">
          <StatRow label="Mota" value={formatEur(d.goal.full.motorcycleCents)} />
          <StatRow
            label="Equipamento por comprar"
            hint={`essencial ${formatEur(d.goal.minimum.gearCents)}`}
            value={formatEur(d.goal.full.gearCents)}
          />
          <StatRow
            label="Custos da compra"
            hint={`essenciais ${formatEur(d.goal.minimum.costsCents)}`}
            value={formatEur(d.goal.full.costsCents)}
          />
          <div className="my-1 border-t border-sep" />
          <StatRow label="Setup completo" value={formatEur(d.full.totalCents)} strong />
          <StatRow label="Mínimo para começar" value={formatEur(d.minimum.totalCents)} />
        </Card>
      </Section>

      <Section title="Contas">
        <Link href="/contas" className="block active:opacity-80">
          <Card className="py-2">
            <StatRow label="Disponível" value={formatEur(d.accounts.available.countedCents)} />
            <StatRow
              label="Investido"
              hint={d.accounts.invested.balanceCents !== d.accounts.invested.countedCents ? "após margem de segurança" : undefined}
              value={formatEur(d.accounts.invested.countedCents)}
            />
            {d.goal.spentCents > 0 && (
              <StatRow label="Já gasto em equipamento" value={<span className="text-success">{formatEur(d.goal.spentCents)}</span>} />
            )}
          </Card>
        </Link>
      </Section>
    </>
  );
}
