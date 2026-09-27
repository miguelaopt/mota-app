"use client";

import { useState } from "react";
import { Field, FormError, MoneyInput, TextArea, TextInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFormAction } from "@/components/ui/useFormAction";
import type { Cents } from "@/lib/finance/money";
import { saveMotorcycleAction } from "./actions";

export interface MotorcycleFormValues {
  id: string;
  model: string;
  priceCents: Cents;
  listingUrl: string | null;
  notes: string | null;
}

export function MotorcycleForm({ motorcycle }: { motorcycle: MotorcycleFormValues | null }) {
  const [saved, setSaved] = useState(false);
  const { error, pending, formProps } = useFormAction(saveMotorcycleAction, () => setSaved(true));

  return (
    <form {...formProps} onChange={() => setSaved(false)} className="space-y-4">
      {motorcycle && <input type="hidden" name="id" value={motorcycle.id} />}
      <Field label="Modelo" htmlFor="model">
        <TextInput id="model" name="model" defaultValue={motorcycle?.model} placeholder="Ex.: Honda CB500 Hornet" maxLength={100} required />
      </Field>
      <Field label="Preço" htmlFor="price">
        <MoneyInput id="price" name="price" defaultCents={motorcycle?.priceCents} required />
      </Field>
      <Field label="Link do anúncio" htmlFor="listing_url">
        <TextInput
          id="listing_url"
          name="listing_url"
          inputMode="url"
          autoCapitalize="none"
          defaultValue={motorcycle?.listingUrl ?? ""}
          placeholder="https://…"
        />
      </Field>
      <Field label="Notas" htmlFor="notes">
        <TextArea id="notes" name="notes" defaultValue={motorcycle?.notes ?? ""} placeholder="Quilómetros, ano, estado, contacto…" maxLength={1000} />
      </Field>
      <FormError error={error} />
      <SubmitButton pending={pending} size="lg" className="w-full">
        {saved ? "Guardado ✓" : motorcycle ? "Guardar" : "Adicionar mota"}
      </SubmitButton>
    </form>
  );
}
