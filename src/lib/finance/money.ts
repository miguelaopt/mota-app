/**
 * Valores monetários em cêntimos (inteiros), para evitar erros de vírgula
 * flutuante. A conversão de/para euros acontece só na fronteira com a base de
 * dados (numeric(12,2) chega como number em euros).
 */
export type Cents = number;

export function toCents(euros: number | null | undefined): Cents {
  if (euros == null || !Number.isFinite(euros)) return 0;
  return Math.round(euros * 100);
}

export function toEuros(cents: Cents): number {
  return Math.round(cents) / 100;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export interface FormatEurOptions {
  /** Omite ",00" quando o valor é redondo (ex.: "6.500 €"). */
  hideZeroCents?: boolean;
  /** Mostra "+" em valores positivos (para diferenças). */
  signed?: boolean;
}

/**
 * Formata cêntimos em euros no formato português: "1.234,56 €".
 * (O Intl de pt-PT dá "1234,56 €" e "12 345,60 €", por isso é feito à mão.)
 */
export function formatEur(cents: Cents, options: FormatEurOptions = {}): string {
  const rounded = Math.round(cents);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;

  let text = groupThousands(String(euros));
  if (!(options.hideZeroCents && rest === 0)) {
    text += "," + String(rest).padStart(2, "0");
  }

  const sign = negative ? "-" : options.signed && rounded > 0 ? "+" : "";
  return `${sign}${text} €`;
}

/**
 * Interpreta um valor escrito pelo utilizador e devolve cêntimos, ou null se
 * não for um número válido. Aceita "1.234,56", "1234,56", "1234.56",
 * "1 234,56 €", "1.234" (milhares) e "12.5" (decimal).
 */
export function parseEur(input: string): Cents | null {
  let text = input.replace(/[\s  €]/g, "");
  if (text === "") return null;

  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  if (!/^[\d.,]+$/.test(text)) return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  let normalized: string;

  if (hasComma && hasDot) {
    // O separador que aparece por último é o decimal.
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      normalized = text.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    if ((text.match(/,/g) ?? []).length > 1) return null;
    normalized = text.replace(",", ".");
  } else if (hasDot) {
    const groups = text.split(".");
    const looksLikeThousands = groups.length > 1 && groups.slice(1).every((g) => g.length === 3) && groups[0].length > 0;
    if (looksLikeThousands) {
      normalized = groups.join("");
    } else if (groups.length === 2) {
      normalized = text;
    } else {
      return null;
    }
  } else {
    normalized = text;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [intPart, decPart = ""] = normalized.split(".");
  if (decPart.length > 2) return null;

  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/**
 * Valor para pré-preencher um input: "1234,56" (sem milhares nem símbolo,
 * para ser fácil de editar no teclado numérico).
 */
export function centsToInput(cents: Cents | null | undefined): string {
  if (cents == null) return "";
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const text = rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

/**
 * Percentagem 0–100 para mostrar. Arredonda para baixo, para nunca mostrar
 * "100%" antes de a meta estar mesmo atingida.
 */
export function formatPct(pct: number, decimals = 0): string {
  const factor = 10 ** decimals;
  const value = Math.floor(Math.max(0, pct) * factor) / factor;
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}
