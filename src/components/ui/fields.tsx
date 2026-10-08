import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { centsToInput, type Cents } from "@/lib/finance/money";

export const inputClass =
  "w-full rounded-xl border border-sep bg-card-2 px-3.5 py-3 text-fg outline-none placeholder:text-muted/70 focus:border-accent focus:ring-1 focus:ring-accent";

export function Field({ label, hint, htmlFor, children }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block px-1 text-sm font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="px-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={cn(inputClass, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} className={cn(inputClass, "resize-none", className)} {...props} />;
}

function Suffixed({ suffix, children }: { suffix: string; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">{suffix}</span>
    </div>
  );
}

/** Valor em euros, com teclado numérico no iPhone. */
export function MoneyInput({
  defaultCents,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "type"> & { defaultCents?: Cents | null }) {
  return (
    <Suffixed suffix="€">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        defaultValue={props.value === undefined ? centsToInput(defaultCents) : undefined}
        className={cn(inputClass, "pr-9 tabular-nums", className)}
        {...props}
      />
    </Suffixed>
  );
}

export function PercentInput({
  defaultPct,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "type"> & { defaultPct?: number }) {
  return (
    <Suffixed suffix="%">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={defaultPct == null ? "" : String(defaultPct).replace(".", ",")}
        className={cn(inputClass, "pr-9 tabular-nums", className)}
        {...props}
      />
    </Suffixed>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(inputClass, "appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/** Controlo segmentado ao estilo iOS (radio buttons). */
export function Segmented<T extends string>({
  name,
  options,
  defaultValue,
  onChange,
}: {
  name: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  defaultValue: T;
  onChange?: (value: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-card-2 p-1" role="radiogroup">
      {options.map((option) => (
        <label key={option.value} className="relative flex-1">
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={option.value === defaultValue}
            onChange={onChange ? () => onChange(option.value) : undefined}
            className="peer sr-only"
          />
          <span className="block cursor-pointer rounded-lg px-2 py-2 text-center text-sm font-medium text-muted transition-colors peer-checked:bg-card peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
      {error}
    </p>
  );
}
