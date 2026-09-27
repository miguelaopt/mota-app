"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

export function SubmitButton({ children, pendingText = "A guardar…", ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
