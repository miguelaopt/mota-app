import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/Badge";
import { Card, Section, StatRow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { getAccounts } from "@/lib/data/accounts";
import { getDashboardData } from "@/lib/data/dashboard";
import { getAttributions, getShift, getShifts } from "@/lib/data/work";
import { formatShortDate, formatTime, toLocalInput } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { formatBp, formatHm } from "@/lib/work/format";
import { estimateShift, isUnusualShift } from "@/lib/work/shift";
import { TARGET_LABEL } from "@/lib/work/view";
import { ShiftEditor } from "./ShiftEditor";

export const metadata: Metadata = { title: "Turno" };

export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireSession();
  const now = new Date();
  const shift = await getShift(supabase, id);
  if (!shift) notFound();

  if (shift.endedAt == null) {
    return (
      <>
        <PageHeader title="Turno a decorrer" back={{ href: "/trabalho", label: "Trabalho" }} />
        <Card>
          <p className="text-muted">Este turno ainda está a decorrer. Pica a saída no ecrã Trabalho para veres o resumo.</p>
          <Link href="/trabalho" className="mt-3 inline-block font-medium text-accent">
            Ir para o turno
          </Link>
        </Card>
      </>
    );
  }

  const [{ dashboard, motorcycle }, attributions, accounts] = await Promise.all([
    getDashboardData(supabase, now),
    shift.attributionId ? getAttributions(supabase) : Promise.resolve([]),
    shift.attributionId ? getAccounts(supabase) : Promise.resolve([]),
  ]);
  const e = estimateShift(shift, shift.endedAt);
  const unusual = isUnusualShift(e);
  const attribution = attributions.find((a) => a.id === shift.attributionId) ?? null;

  // Diferença entre o planeado (estimativas atuais) e o que foi confirmado.
  let plannedForAttribution = 0;
  if (attribution) {
    const linked = (await getShifts(supabase)).filter((s) => attribution.shiftIds.includes(s.id) && s.endedAt != null);
    plannedForAttribution = linked.reduce((sum, s) => sum + estimateShift(s, s.endedAt!).plannedCents, 0);
  }
  const accountName = attribution ? (accounts.find((a) => a.id === attribution.accountId)?.name ?? "conta") : null;
  const goalTotal = shift.target === "minimum" ? dashboard.minimum.totalCents : dashboard.full.totalCents;
  const model = motorcycle?.model ?? "mota";

  return (
    <>
      <PageHeader
        title="Resumo do turno"
        subtitle={`${formatShortDate(new Date(shift.startedAt), now)} · ${formatTime(shift.startedAt)}–${formatTime(shift.endedAt)}`}
        back={{ href: "/trabalho", label: "Trabalho" }}
      />

      {unusual && (
        <Notice className="mb-4">
          Duração invulgar ({formatHm(e.totalMs)}). Confirma se a entrada e a saída estão certas e corrige abaixo se for preciso.
        </Notice>
      )}

      <Card className="p-5">
        <p className="text-sm text-muted">Planeado para a {model}</p>
        <p className="text-[2.2rem] font-extrabold leading-tight tracking-tight text-accent tabular-nums">{formatEur(e.plannedCents)}</p>
        <p className="text-sm text-muted tabular-nums">
          {formatEur(e.earnedCents)} {shift.payMode === "monthly" ? "de equivalente de salário" : "de ganhos estimados"} ×{" "}
          {formatBp(shift.allocationBp)}
        </p>
        <div className="mt-4 border-t border-sep pt-2">
          <StatRow label="Duração total" value={formatHm(e.totalMs)} />
          <StatRow
            label="Pausas"
            value={formatHm(e.breakMs)}
            hint={e.breakMs > 0 ? (e.unpaidBreakMs > 0 ? `${formatHm(e.unpaidBreakMs)} não remuneradas` : "remuneradas") : undefined}
          />
          <StatRow label="Duração paga" value={formatHm(e.paidMs)} strong />
          <StatRow label="Valor/hora deste turno" hint="copiado ao picar a entrada" value={`${formatEur(shift.hourlyRateCents)}/h`} />
          <StatRow label="Objetivo" value={<span className="first-letter:uppercase">{TARGET_LABEL[shift.target]}</span>} />
          {shift.plannedEndAt && <StatRow label="Saída prevista" value={formatTime(shift.plannedEndAt)} />}
        </div>
      </Card>

      {shift.version > 1 && shift.originalStartedAt && (
        <p className="mt-3 px-1 text-sm text-muted">
          Horário corrigido{shift.editedAt ? ` a ${formatShortDate(new Date(shift.editedAt), now)}` : ""}. Original:{" "}
          {formatTime(shift.originalStartedAt)}–{shift.originalEndedAt ? formatTime(shift.originalEndedAt) : "?"}.
        </p>
      )}

      <Section title="Poupança">
        <Card className="py-2">
          {attribution ? (
            <>
              <StatRow
                label="Confirmada"
                hint={`${formatShortDate(new Date(attribution.confirmedAt), now)} · ${accountName}${attribution.shiftIds.length > 1 ? ` · ${attribution.shiftIds.length} turnos` : ""}`}
                value={<span className="text-success">{formatEur(attribution.amountCents)}</span>}
              />
              <StatRow label="Planeado nesses turnos" value={formatEur(plannedForAttribution)} />
              {plannedForAttribution !== attribution.amountCents && (
                <StatRow
                  label="Diferença"
                  hint="planeado e guardado não têm de coincidir"
                  value={formatEur(attribution.amountCents - plannedForAttribution, { signed: true })}
                />
              )}
            </>
          ) : (
            <>
              <StatRow label="Estado" value={<span className="text-accent">Por confirmar</span>} />
              <StatRow label="Já guardado (real)" value={formatEur(dashboard.savedCents)} />
              {goalTotal > 0 && (
                <StatRow
                  label="Projeção após guardar"
                  hint={`faltariam ${formatEur(Math.max(0, goalTotal - dashboard.savedCents - e.plannedCents))} para o ${TARGET_LABEL[shift.target]}`}
                  value={formatEur(dashboard.savedCents + e.plannedCents)}
                />
              )}
            </>
          )}
        </Card>
        {!attribution && (
          <Link href="/trabalho/confirmar" className="mt-2 inline-block px-1 text-sm font-medium text-accent">
            Confirmar poupança
          </Link>
        )}
      </Section>

      <ShiftEditor
        id={shift.id}
        startedAt={toLocalInput(shift.startedAt)}
        endedAt={toLocalInput(shift.endedAt)}
        max={toLocalInput(now)}
        canDelete={!attribution}
        breaks={shift.breaks.map((b) => ({
          id: b.id,
          label: `${formatTime(b.startedAt)}–${b.endedAt ? formatTime(b.endedAt) : "…"} · ${b.paid ? "remunerada" : "não remunerada"}`,
        }))}
      />
    </>
  );
}
