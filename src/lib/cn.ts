import { twMerge } from "tailwind-merge";

/** Junta classes; em conflitos do Tailwind (ex.: p-4 e p-0) ganha a última. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
