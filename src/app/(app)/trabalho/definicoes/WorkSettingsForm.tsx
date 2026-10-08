"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError, MoneyInput, PercentInput, Segmented, TextInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import { centsToInput, formatEur, parseEur } from "@/lib/finance/money";
import { monthlyToHourlyCents, type GoalTarget, type PayMode } from "@/lib/work/shift";
import { saveWorkSettingsAction } from "../actions";

export interface WorkSettingsValues {
  jobName: string;
  payMode: PayMode;
  hourlyRateCents: number | null;
  monthlySalaryCents: number | null;
  monthlyHours: number | null;
  allocationPct: number;
  target: GoalTarget;
  paidBreaks: boolean;
  referenceHours: number | null;
  shiftsPerWeek: number | null;
  haptics: boolean;
  animations: boolean;
}

const PAY_OPTIONS = [
  { value: "hourly", label: "Por hora" },
  { value: "monthly", label: "Salário fixo" },
] as const;

const TARGET_OPTIONS = [
  { value: "minimum", label: "Mínimo para andar" },
  { value: "full", label: "Setup completo" },
] as const;

const BREAK_OPTIONS = [
  { value: "unpaid", label: "Não remuneradas" },
  { value: "paid", label: "Remuneradas" },
] as const;

const num = (value: number | null) => (value == null ? "" : String(value).replace(".", ","));

export function WorkSettingsForm({ values, isNew }: { values: WorkSettingsValues; isNew: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const { error, pending, formProps } = useFormAction(saveWorkSettingsAction, () => {
    if (isNew) router.push("/trabalho");
    else setSaved(true);
  });
  const [payMode, setPayMode] = useState<PayMode>(values.payMode);
  const [salary, setSalary] = useState(centsToInput(values.monthlySalaryCents));
  const [hours, setHours] = useState(num(values.monthlyHours));
  // Valor/hora em salário fixo: calculado pela fórmula até o utilizador o corrigir.
  const [rateTouched, setRateTouched] = useState(
    values.payMode === "monthly" &&
      values.hourlyRateCents != null &&
      values.hourlyRateCents !== monthlyToHourlyCents(values.monthlySalaryCents ?? 0, values.monthlyHours ?? 0),
  );
  const [rate, setRate] = useState(centsToInput(values.hourlyRateCents));

  const salaryCents = parseEur(salary);
  const hoursValue = Number(hours.replace(",", "."));
  const formulaCents = salaryCents != null && hoursValue > 0 ? monthlyToHourlyCents(salaryCents, hoursValue) : null;
  const shownRate = payMode === "monthly" && !rateTouched && formulaCents != null ? centsToInput(formulaCents) : rate;

  return (
    <form {...formProps} onChange={() => setSaved(false)} className="space-y-5">
      <Field label="Trabalho" htmlFor="job_name">
        <TextInput id="job_name" name="job_name" defaultValue={values.jobName} placeholder="Ex.: Pizza Hut" maxLength={60} required />
      </Field>

      <Field label="Como recebes">
        <Segmented name="pay_mode" options={PAY_OPTIONS} defaultValue={values.payMode} onChange={setPayMode} />
      </Field>

      {payMode === "hourly" ? (
        <Field label="Valor líquido por hora (estimado)" htmlFor="hourly_rate" hint="O que recebes por hora, já sem descontos. A app não calcula impostos.">
          <MoneyInput id="hourly_rate" name="hourly_rate" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Líquido por mês" htmlFor="monthly_salary">
              <MoneyInput id="monthly_salary" name="monthly_salary" value={salary} onChange={(e) => setSalary(e.target.value)} />
            </Field>
            <Field label="Horas por mês" htmlFor="monthly_hours">
              <TextInput
                id="monthly_hours"
                name="monthly_hours"
                inputMode="decimal"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Ex.: 160"
              />
            </Field>
          </div>
          <Field
            label="Valor/hora usado nas contas"
            htmlFor="hourly_rate"
            hint={
              formulaCents != null
                ? `${formatEur(salaryCents!)} ÷ ${hours} h = ${formatEur(formulaCents)}/h. Podes corrigir este valor.`
                : "Preenche o salário e as horas para calcular o equivalente por hora."
            }
          >
            <MoneyInput
              id="hourly_rate"
              name="hourly_rate"
              value={shownRate}
              onChange={(e) => {
                setRateTouched(true);
                setRate(e.target.value);
              }}
            />
          </Field>
          <p className="-mt-2 px-1 text-xs text-muted">
            Com salário fixo, o tempo de cada turno mostra o equivalente de salário. Um turno a mais não significa salário a mais.
          </p>
        </>
      )}

      <Field
        label="Percentagem dos ganhos para a mota"
        htmlFor="allocation_pct"
        hint="Só a parte que pensas guardar. Usada para as horas em falta e para o valor planeado de cada turno."
      >
        <PercentInput id="allocation_pct" name="allocation_pct" defaultPct={values.allocationPct} />
      </Field>

      <Field label="Meta de referência">
        <Segmented name="target" options={TARGET_OPTIONS} defaultValue={values.target} />
      </Field>

      <Field label="As tuas pausas costumam ser">
        <Segmented name="paid_breaks" options={BREAK_OPTIONS} defaultValue={values.paidBreaks ? "paid" : "unpaid"} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Duração paga de um turno (h)" htmlFor="reference_hours">
          <TextInput id="reference_hours" name="reference_hours" inputMode="decimal" defaultValue={num(values.referenceHours)} placeholder="média" />
        </Field>
        <Field label="Turnos por semana" htmlFor="shifts_per_week">
          <TextInput id="shifts_per_week" name="shifts_per_week" inputMode="decimal" defaultValue={num(values.shiftsPerWeek)} placeholder="opcional" />
        </Field>
      </div>
      <p className="-mt-3 px-1 text-xs text-muted">
        A duração serve para os «turnos equivalentes» (vazio = média dos teus turnos). Os turnos por semana dão um mês aproximado.
      </p>

      <fieldset className="space-y-2 rounded-xl bg-card-2 px-3.5 py-3">
        <label className="flex items-center justify-between gap-3">
          <span>Vibração ao picar</span>
          <input type="checkbox" name="haptics" defaultChecked={values.haptics} className="h-5 w-5 accent-[var(--accent)]" />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Animações</span>
          <input type="checkbox" name="animations" defaultChecked={values.animations} className="h-5 w-5 accent-[var(--accent)]" />
        </label>
      </fieldset>

      <p className="px-1 text-xs text-muted">Valores em euros, horas na hora de Portugal continental (Europe/Lisbon).</p>

      <FormError error={error} />
      <SubmitButton pending={pending} size="lg" className="w-full">
        {isNew ? "Começar" : saved ? "Guardado ✓" : "Guardar"}
      </SubmitButton>
      {!isNew && (
        <p className="px-1 text-xs text-muted">
          As alterações valem para os próximos turnos. Os turnos já registados mantêm as condições com que foram picados.
        </p>
      )}
    </form>
  );
}
