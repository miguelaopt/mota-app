import { describe, expect, it } from "vitest";
import { centsToInput, formatEur, formatPct, parseEur, toCents, toEuros } from "./money";

describe("toCents / toEuros", () => {
  it("converte sem erros de vírgula flutuante", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents(19.99)).toBe(1999);
    expect(toEuros(123456)).toBe(1234.56);
  });

  it("trata null e valores inválidos como 0", () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents(Number.NaN)).toBe(0);
  });
});

// formatEur usa um espaço não separável antes do "€".
const eur = (text: string) => text.replace(" €", "\u00a0€");

describe("formatEur", () => {
  it("usa ponto nos milhares e vírgula nos decimais", () => {
    expect(formatEur(123456)).toBe(eur("1.234,56 €"));
    expect(formatEur(1234560)).toBe(eur("12.345,60 €"));
    expect(formatEur(123456789)).toBe(eur("1.234.567,89 €"));
  });

  it("formata valores pequenos e zero", () => {
    expect(formatEur(0)).toBe(eur("0,00 €"));
    expect(formatEur(5)).toBe(eur("0,05 €"));
    expect(formatEur(99900)).toBe(eur("999,00 €"));
  });

  it("formata negativos", () => {
    expect(formatEur(-123456)).toBe(eur("-1.234,56 €"));
  });

  it("pode omitir cêntimos a zero", () => {
    expect(formatEur(650000, { hideZeroCents: true })).toBe(eur("6.500 €"));
    expect(formatEur(650050, { hideZeroCents: true })).toBe(eur("6.500,50 €"));
  });

  it("pode mostrar o sinal +", () => {
    expect(formatEur(2500, { signed: true })).toBe(eur("+25,00 €"));
    expect(formatEur(-2500, { signed: true })).toBe(eur("-25,00 €"));
    expect(formatEur(0, { signed: true })).toBe(eur("0,00 €"));
  });
});

describe("parseEur", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["1 234,56 €", 123456],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["12.5", 1250],
    ["12,5", 1250],
    ["0,05", 5],
    ["1,234.56", 123456],
    ["  300  ", 30000],
    ["-50", -5000],
    ["+50", 5000],
    ["€ 7.500", 750000],
  ])("%s → %d cêntimos", (input, expected) => {
    expect(parseEur(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "1,2,3", "12.345,678", "1.2.3", "12,345", "--5", "5-"])("rejeita %j", (input) => {
    const value = parseEur(input);
    // "12,345" é interpretado como decimal com 3 casas → inválido
    expect(value).toBeNull();
  });
});

describe("centsToInput", () => {
  it("dá um valor fácil de editar", () => {
    expect(centsToInput(123456)).toBe("1234,56");
    expect(centsToInput(650000)).toBe("6500");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(null)).toBe("");
    expect(centsToInput(-1050)).toBe("-10,50");
  });

  it("faz ida e volta com parseEur", () => {
    for (const cents of [0, 5, 99, 100, 123456, 99999999]) {
      expect(parseEur(centsToInput(cents))).toBe(cents);
    }
  });
});

describe("formatPct", () => {
  it("arredonda para baixo para não mostrar 100% antes do tempo", () => {
    expect(formatPct(99.99)).toBe("99%");
    expect(formatPct(100)).toBe("100%");
    expect(formatPct(45.67, 1)).toBe("45,6%");
    expect(formatPct(-3)).toBe("0%");
  });
});
