import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { Card, ListGroup, Section } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReceivePaymentForm } from "@/components/work/ReceivePaymentForm";
import { requireSession } from "@/lib/auth";
import { getAccounts } from "@/lib/data/accounts";
import { getSnapshots } from "@/lib/data/snapshots";
import { getAttributions, getShifts } from "@/lib/data/work";
import { formatShortDate } from "@/lib/dates";
import { formatEur } from "@/lib/finance/money";
import { buildConfirmData } from "@/lib/work/confirm";
import { UndoAttributionButton } from "./UndoAttributionButton";

export const metadata: Metadata = { title: "Recebi o pagamento" };

export default async function ConfirmSavingsPage() {
  const { supabase } = await requireSession();
  const now = new Date();
  const [shifts, accounts, snapshots, attributions] = await Promise.all([
    getShifts(supabase),
    getAccounts(supabase),
    getSnapshots(supabase),
    getAttributions(supabase),
  ]);
  const data = buildConfirmData({ shifts, accounts, snapshots, attributions, now });
  const names = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader
        title="Recebi o pagamento"
        back={{ href: "/trabalho", label: "Trabalho" }}
        subtitle="Quando o dinheiro do trabalho entrar numa conta, regista aqui quanto foi. Só assim o planeado passa a dinheiro contabilizado."
      />

      <Card className="p-5">
        <ReceivePaymentForm data={data} attributionId={randomUUID()} renderedAt={now.getTime()} redirectTo="/trabalho" />
      </Card>

      {attributions.length > 0 && (
        <Section title="Confirmações anteriores">
          <ListGroup>
            {attributions.slice(0, 30).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-3 pl-4 pr-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {formatEur(a.amountCents)} · {names.get(a.accountId) ?? "Conta"}
                  </p>
                  <p className="text-sm text-muted">
                    {formatShortDate(new Date(a.confirmedAt), now)}
                    {a.shiftIds.length > 0 && ` · ${a.shiftIds.length} ${a.shiftIds.length === 1 ? "turno" : "turnos"}`}
                    {a.notes && ` · ${a.notes}`}
                  </p>
                </div>
                <UndoAttributionButton id={a.id} />
              </div>
            ))}
          </ListGroup>
          <p className="mt-2 px-1 text-xs text-muted">
            Anular uma confirmação devolve os turnos a &quot;por confirmar&quot;. O saldo da conta e o histórico de saldos não mudam.
          </p>
        </Section>
      )}
    </>
  );
}
