import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { getWorkSettings } from "@/lib/data/work";
import { bpToPct } from "@/lib/work/shift";
import { WorkSettingsForm } from "./WorkSettingsForm";

export const metadata: Metadata = { title: "Configurar trabalho" };

export default async function WorkSettingsPage() {
  const { supabase } = await requireSession();
  const settings = await getWorkSettings(supabase);

  return (
    <>
      <PageHeader
        title={settings ? "Definições do trabalho" : "Configurar trabalho"}
        back={{ href: "/trabalho", label: "Trabalho" }}
        subtitle={settings ? undefined : "Estes valores servem só para estimativas. O dinheiro real continua a vir das contas."}
      />
      <Card>
        <WorkSettingsForm
          isNew={!settings}
          values={{
            jobName: settings?.jobName ?? "",
            payMode: settings?.payMode ?? "hourly",
            hourlyRateCents: settings?.hourlyRateCents ?? null,
            monthlySalaryCents: settings?.monthlySalaryCents ?? null,
            monthlyHours: settings?.monthlyHours ?? null,
            allocationPct: settings ? bpToPct(settings.allocationBp) : 100,
            target: settings?.target ?? "minimum",
            paidBreaks: settings?.paidBreaks ?? false,
            referenceHours: settings?.referenceShiftMinutes ? Math.round((settings.referenceShiftMinutes / 60) * 100) / 100 : null,
            shiftsPerWeek: settings?.shiftsPerWeek ?? null,
            haptics: settings?.haptics ?? true,
            animations: settings?.animations ?? true,
          }}
        />
      </Card>
    </>
  );
}
