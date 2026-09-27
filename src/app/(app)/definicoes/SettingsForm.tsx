"use client";

import { useState } from "react";
import { Field, FormError, MoneyInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import type { Cents } from "@/lib/finance/money";
import { saveSettingsAction } from "./actions";

export function SettingsForm({ monthlyGoalCents }: { monthlyGoalCents: Cents }) {
  const [saved, setSaved] = useState(false);
  const { error, formAction } = useFormAction(saveSettingsAction, () => setSaved(true));

  return (
    <form action={formAction} onChange={() => setSaved(false)} className="space-y-4">
      <Field
        label="Meta de poupança mensal"
        htmlFor="monthly_goal"
        hint="Usada para a data prevista enquanto não houver pelo menos um mês de histórico de saldos."
      >
        <MoneyInput id="monthly_goal" name="monthly_goal" defaultCents={monthlyGoalCents} />
      </Field>
      <FormError error={error} />
      <SubmitButton className="w-full">{saved ? "Guardado ✓" : "Guardar"}</SubmitButton>
    </form>
  );
}
