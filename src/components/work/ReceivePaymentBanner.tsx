"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { formatEur } from "@/lib/finance/money";
import type { ConfirmData } from "@/lib/work/confirm";
import { ReceivePaymentForm } from "./ReceivePaymentForm";

/**
 * Aviso do dinheiro planeado em turnos feitos que ainda não está nas contas,
 * com "Recebi" para o confirmar sem sair do ecrã.
 */
export function ReceivePaymentBanner({
  data,
  attributionId,
  renderedAt,
  className,
}: {
  data: ConfirmData;
  attributionId: string;
  renderedAt: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (data.pending.length === 0) return null;
  const count = data.pending.length;

  return (
    <>
      <section
        className={cn(
          "flex items-center gap-3 rounded-[20px] border border-accent-line bg-accent-soft py-3.5 pl-4 pr-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] backdrop-blur-xl",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="display text-2xl text-accent">{formatEur(data.pendingCents)} por confirmar</p>
          <p className="mt-0.5 text-xs text-muted">
            {count} {count === 1 ? "turno feito" : "turnos feitos"} · ainda não {count === 1 ? "está" : "estão"} nas contas
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 shrink-0 rounded-[14px] bg-accent px-4 text-sm font-semibold text-accent-fg active:scale-[0.98] active:opacity-80"
        >
          Recebi
        </button>
      </section>
      <Sheet open={open} onClose={() => setOpen(false)} title="Recebi o pagamento">
        <ReceivePaymentForm data={data} attributionId={attributionId} renderedAt={renderedAt} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
