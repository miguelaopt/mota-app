"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError, TextInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {
    step: "email",
    error: linkError ? "O link expirou ou já foi usado. Pede um novo código." : undefined,
  });

  if (state.step === "code") {
    return (
      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="email" value={state.email} />
        <div className="rounded-2xl bg-card p-4 text-sm">
          <p className="font-medium">{state.info ?? `Enviámos um email para ${state.email}.`}</p>
          <p className="mt-1 text-muted">
            Escreve aqui o código de 6 dígitos. No iPhone, usa o código em vez do link: o link abre no Safari e não na app.
          </p>
        </div>
        <Field label="Código" htmlFor="token">
          <TextInput
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            placeholder="123456"
            autoFocus
            required
            className="text-center text-2xl tracking-[0.4em] tabular-nums"
          />
        </Field>
        <FormError error={state.error} />
        <SubmitButton name="intent" value="verify" size="lg" className="w-full" pendingText="A entrar…">
          Entrar
        </SubmitButton>
        <div className="flex justify-between gap-2">
          <Button type="submit" name="intent" value="reset" variant="ghost" size="sm" formNoValidate>
            Outro email
          </Button>
          <Button type="submit" name="intent" value="send" variant="ghost" size="sm" formNoValidate>
            Reenviar código
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <Field label="Email" htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          defaultValue={state.email}
          placeholder="nome@exemplo.pt"
          required
        />
      </Field>
      <FormError error={state.error} />
      <SubmitButton name="intent" value="send" size="lg" className="w-full" pendingText="A enviar…">
        Enviar código
      </SubmitButton>
      <p className="px-1 text-center text-xs text-muted">Recebes um email com um código e um link para entrar.</p>
    </form>
  );
}
