"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

/**
 * Botão de submeter com estado "a guardar". Usa `pending` quando é dado
 * (formulários com useFormAction) ou o estado do <form action> pai.
 */
export function SubmitButton({
  children,
  pending: pendingProp,
  pendingText = "A guardar…",
  ...props
}: ButtonProps & { pending?: boolean; pendingText?: string }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
