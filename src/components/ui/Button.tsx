import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg shadow-[0_10px_28px_rgb(42_245_179/0.22)]",
  secondary: "border border-glass-border bg-white/[0.06] text-fg",
  ghost: "text-accent",
  danger: "border border-danger/25 bg-danger-soft text-danger",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-4 rounded-[14px]",
  lg: "h-14 px-5 text-[17px] rounded-2xl",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-1.5 font-semibold transition-[opacity,transform] duration-150 active:scale-[0.98] active:opacity-80 disabled:opacity-45 disabled:active:scale-100",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
