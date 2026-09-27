import { parseEur, toEuros } from "./finance/money";

/** Erro de validação, com uma mensagem para mostrar ao utilizador. */
export class FormError extends Error {}

function raw(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function getText(form: FormData, name: string, { label = name, max = 200, required = false } = {}): string | null {
  const value = raw(form, name);
  if (!value) {
    if (required) throw new FormError(`Preenche o campo "${label}".`);
    return null;
  }
  if (value.length > max) throw new FormError(`"${label}" é demasiado longo (máx. ${max} caracteres).`);
  return value;
}

export function getRequiredText(form: FormData, name: string, options: { label?: string; max?: number } = {}): string {
  return getText(form, name, { ...options, required: true }) as string;
}

/** Valor em euros (number com 2 casas) a partir de "1.234,56". Vazio = 0. */
export function getMoney(form: FormData, name: string, { label = name, allowNegative = false } = {}): number {
  const value = raw(form, name);
  if (!value) return 0;
  const cents = parseEur(value);
  if (cents == null) throw new FormError(`"${label}" não é um valor válido.`);
  if (!allowNegative && cents < 0) throw new FormError(`"${label}" não pode ser negativo.`);
  if (Math.abs(cents) >= 1e12) throw new FormError(`"${label}" é demasiado grande.`);
  return toEuros(cents);
}

/** Percentagem 0–100 (aceita vírgula decimal). Vazio = valor por omissão. */
export function getPercent(form: FormData, name: string, { label = name, fallback = 100 } = {}): number {
  const value = raw(form, name).replace("%", "").replace(",", ".").trim();
  if (!value) return fallback;
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new FormError(`"${label}" tem de estar entre 0 e 100.`);
  return Math.round(pct * 100) / 100;
}

/** URL http(s); acrescenta https:// se faltar. Vazio = null. */
export function getUrl(form: FormData, name: string, { label = name } = {}): string | null {
  let value = raw(form, name);
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    if (!url.hostname.includes(".")) throw new Error();
    return url.toString();
  } catch {
    throw new FormError(`"${label}" não é um link válido.`);
  }
}

export function getEnum<T extends string>(form: FormData, name: string, values: readonly T[], fallback: T): T {
  const value = raw(form, name);
  return (values as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function getId(form: FormData, name = "id"): string {
  const value = raw(form, name);
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new FormError("Pedido inválido.");
  return value;
}
