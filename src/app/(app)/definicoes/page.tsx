import type { Metadata } from "next";
import { signOutAction } from "@/app/login/actions";
import { Card, Section } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Definições" };

export default async function SettingsPage() {
  const { supabase, email } = await requireSession();
  const settings = await getSettings(supabase);

  return (
    <>
      <PageHeader title="Definições" back={{ href: "/", label: "Início" }} />

      <Card>
        <SettingsForm monthlyGoalCents={settings.monthlyGoalCents} />
      </Card>

      <Section title="Sessão">
        <Card className="space-y-3">
          {email && (
            <p className="text-sm text-muted">
              Entraste como <span className="font-medium text-fg">{email}</span>
            </p>
          )}
          <form action={signOutAction}>
            <SubmitButton variant="danger" className="w-full" pendingText="A sair…">
              Terminar sessão
            </SubmitButton>
          </form>
        </Card>
      </Section>
    </>
  );
}
