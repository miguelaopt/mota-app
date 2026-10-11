"use client";

import Link from "next/link";
import { BriefcaseIcon, PlayIcon } from "@/components/icons";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatTime } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { haptic } from "@/lib/haptics";
import { formatClock, formatHm, formatShortDuration } from "@/lib/work/format";
import { estimateShift } from "@/lib/work/shift";
import type { WorkClientData } from "@/lib/work/view";
import { earningsLabelLower } from "./clockHelpers";
import { WorkToday } from "./WorkToday";
import { useNow, useWorkClock } from "./useWorkClock";

/** Bloco do modo Trabalho no Início. Sem configuração, convida a configurar. */
export function WorkHomeCard({ data, model }: { data: WorkClientData | null; model: string }) {
  if (!data) {
    return (
      <Card className="mt-4 flex items-center gap-4 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <BriefcaseIcon size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">Transforma os teus turnos em progresso para a {model}</p>
          <Link href="/trabalho/definicoes" className="mt-1 inline-block text-sm font-medium text-accent">
            Configurar trabalho
          </Link>
        </div>
      </Card>
    );
  }
  return <ConfiguredCard data={data} />;
}

function ConfiguredCard({ data }: { data: WorkClientData }) {
  const clock = useWorkClock({ userId: data.userId, serverActive: data.activeShift, renderedAt: data.renderedAt });
  const active = clock.active;
  const now = useNow(active != null, data.renderedAt);
  const terms = data.settings;

  if (active) {
    const e = estimateShift({ ...active, endedAt: null }, now);
    const onBreak = e.openBreak;
    return (
      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-accent">
            {onBreak ? (onBreak.paid ? "Em pausa remunerada" : "Em pausa não remunerada") : "Turno a decorrer"}
          </p>
          <p className="text-sm text-muted tabular-nums">entrada {formatTime(active.startedAt)}</p>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-bold tabular-nums" role="timer">
              {formatClock(e.paidMs)}
            </p>
            <p className="text-sm text-muted tabular-nums">
              {formatEur(e.earnedCents)} {earningsLabelLower(active.payMode)} · {formatEur(e.plannedCents)} para a mota
            </p>
          </div>
        </div>
        {onBreak ? (
          <p className="mt-1 text-sm text-muted tabular-nums">Em pausa há {formatShortDuration(now - onBreak.startedAt)}.</p>
        ) : (
          active.plannedEndAt != null && (
            <p className="mt-1 text-sm text-muted tabular-nums">
              {e.overtimeMs > 0
                ? `Saída prevista ultrapassada em ${formatShortDuration(e.overtimeMs)}`
                : `${formatHm(e.remainingMs ?? 0)} até à saída prevista`}
            </p>
          )
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {onBreak ? (
            <Button
              variant="secondary"
              onClick={() => {
                if (!clock.dispatch({ type: "break_end", shiftId: active.id, breakId: onBreak.id, at: Date.now() })) haptic(terms.haptics);
              }}
            >
              <PlayIcon size={18} /> Retomar
            </Button>
          ) : null}
          <Link href="/trabalho" className={buttonClass("primary", "md", onBreak ? undefined : "col-span-2")}>
            Ver turno
          </Link>
        </div>
      </Card>
    );
  }

  return <WorkToday data={data} onHome />;
}

/** Linha do resumo financeiro: planeado neste turno / por confirmar, sempre separado do saldo real. */
export function WorkProjectionLine({ data }: { data: WorkClientData }) {
  const clock = useWorkClock({ userId: data.userId, serverActive: data.activeShift, renderedAt: data.renderedAt });
  const now = useNow(clock.active != null, data.renderedAt, 5000);
  const live = clock.active ? estimateShift({ ...clock.active, endedAt: null }, now).plannedCents : 0;
  if (live <= 0 && data.pendingPlannedCents <= 0) return null;
  return (
    <div className="mt-1 space-y-0.5 text-sm tabular-nums">
      {live > 0 && <p className="font-medium text-accent">+{formatEur(live)} planeados neste turno</p>}
      {data.pendingPlannedCents > 0 && (
        <p className="text-muted">
          <span className="font-medium text-fg">{formatEur(data.pendingPlannedCents)}</span> planeados por confirmar (projeção)
        </p>
      )}
    </div>
  );
}
