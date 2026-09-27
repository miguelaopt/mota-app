import Link from "next/link";
import { CheckIcon, ChevronRightIcon, MotorcycleIcon, SlidersIcon } from "@/components/icons";
import { Card, ListGroup, Section, StatRow } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { requireSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getDashboardData } from "@/lib/data/dashboard";
import { signPhotoUrls } from "@/lib/data/photos";
import { formatDuration, formatMonthYear } from "@/lib/dates";
import type { TargetStatus } from "@/lib/finance/dashboard";
import type { Forecast } from "@/lib/finance/forecast";
import { formatEur, formatPct } from "@/lib/finance/money";

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
    <Card className="flex flex-col gap-2 p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <p className="text-lg font-bold leading-tight tabular-nums">{formatEur(target.totalCents, { hideZeroCents: true })}</p>
      <ProgressBar
        pct={target.pct}
        size="sm"
        tone={target.reached ? "success" : "accent"}
        label={`${title}: ${formatPct(target.pct)}`}
      />
      <p className="text-sm tabular-nums">
        {target.reached ? (
          <span className="font-medium text-success">Atingido ✓</span>
        ) : (
          <>
            <span className="text-muted">Falta </span>
            <span className="font-medium">{formatEur(target.missingCents, { hideZeroCents: true })}</span>
          </>
        )}
      </p>
      {!target.reached && <p className="text-sm text-muted">{forecast.date}</p>}
    </Card>
  );
}

export default async function HomePage() {
  const { supabase } = await requireSession();
  const now = new Date();
  const { motorcycle, settings, dashboard: d, unpricedGear, unpricedCosts } = await getDashboardData(supabase, now);
  const photos = await signPhotoUrls(supabase, [motorcycle?.photoPath]);
  const photoUrl = motorcycle?.photoPath ? photos[motorcycle.photoPath] : undefined;
  const fullForecast = forecastLabel(d.full.forecast);
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
      {/* Cabeçalho com a foto da mota */}
      <div className="relative mt-1">
        <Link
          href="/mota"
          className="relative block aspect-[16/10] overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-orange-700 active:opacity-90"
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={motorcycle?.model ?? ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-white/85">
              <MotorcycleIcon size={88} strokeWidth={1.4} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 pt-14 text-white">
            {motorcycle ? (
              <>
                <p className="text-sm text-white/80">A tua próxima mota</p>
                <p className="text-2xl font-bold leading-tight">{motorcycle.model}</p>
                <p className="text-sm font-medium text-white/90 tabular-nums">{formatEur(motorcycle.priceCents, { hideZeroCents: true })}</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold leading-tight">Qual é a mota?</p>
                <p className="text-sm text-white/85">Toca para escolheres o modelo e o preço.</p>
              </>
            )}
          </div>
        </Link>
        <Link
          href="/definicoes"
          aria-label="Definições"
          className="absolute right-3 top-3 rounded-full bg-black/35 p-2 text-white backdrop-blur-md active:opacity-70"
        >
          <SlidersIcon size={20} />
        </Link>
      </div>

      {/* Progresso principal */}
      {hasGoal ? (
        <Card className="mt-4 p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted">Já juntaste</p>
              <p className="text-[2.1rem] font-bold leading-tight tracking-tight tabular-nums">{formatEur(d.savedCents)}</p>
              <p className="text-sm text-muted tabular-nums">de {formatEur(d.full.totalCents)} para o setup completo</p>
            </div>
            <p
              className={cn(
                "text-[2.6rem] font-extrabold leading-none tracking-tight tabular-nums",
                d.full.reached ? "text-success" : "text-accent",
              )}
            >
              {formatPct(d.full.pct)}
            </p>
          </div>

          <div className="relative mt-5 pb-5">
            <ProgressBar pct={d.full.pct} size="lg" tone={d.full.reached ? "success" : "accent"} label={`Progresso: ${formatPct(d.full.pct)}`} />
            {d.minimumMarkPct > 0 && d.minimumMarkPct < 100 && (
              <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${d.minimumMarkPct}%` }} aria-hidden>
                <span className="h-4 w-0.5 rounded-full bg-fg/60" />
                <span className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted">mínimo</span>
              </div>
            )}
          </div>

          {d.full.reached ? (
            <p className="mt-2 rounded-2xl bg-success-soft px-4 py-3 font-semibold text-success">
              Meta atingida! 🎉 Está na hora de ir buscar a mota.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 border-t border-sep pt-4">
              <div>
                <p className="text-sm text-muted">Falta</p>
                <p className="text-xl font-bold tabular-nums">{formatEur(d.full.missingCents)}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Data prevista</p>
                <p className="text-lg font-bold leading-snug first-letter:uppercase">{fullForecast.date}</p>
              </div>
              <p className="col-span-2 text-sm text-muted">
                {d.full.forecast.source === "none" ? (
                  <Link href="/definicoes" className="text-accent">
                    {fullForecast.detail}
                  </Link>
                ) : (
                  fullForecast.detail
                )}
              </p>
            </div>
          )}
        </Card>
      ) : (
        <Card className="mt-4 p-5">
          <p className="text-sm text-muted">Já juntaste</p>
          <p className="text-[2.1rem] font-bold leading-tight tracking-tight tabular-nums">{formatEur(d.savedCents)}</p>
          <p className="mt-2 text-muted">
            Ainda não há meta. Escolhe a mota e põe os preços do equipamento e dos custos para veres quanto falta.
          </p>
        </Card>
      )}

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
              <Link key={step.href} href={step.href} className="flex items-center gap-3 px-4 py-3 active:bg-card-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                    step.done ? "border-success bg-success text-white" : "border-track",
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
