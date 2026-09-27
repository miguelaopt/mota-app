import { describe, expect, it } from "vitest";
import { FormError, getEnum, getMoney, getPercent, getRequiredText, getText, getUrl } from "./forms";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe("getMoney", () => {
  it("converte o formato português para euros", () => {
    expect(getMoney(form({ v: "1.234,56" }), "v")).toBe(1234.56);
    expect(getMoney(form({ v: "" }), "v")).toBe(0);
  });

  it("rejeita valores inválidos e negativos", () => {
    expect(() => getMoney(form({ v: "abc" }), "v")).toThrow(FormError);
    expect(() => getMoney(form({ v: "-5" }), "v")).toThrow(FormError);
    expect(getMoney(form({ v: "-5" }), "v", { allowNegative: true })).toBe(-5);
  });
});

describe("getPercent", () => {
  it("aceita vírgula e usa o valor por omissão", () => {
    expect(getPercent(form({ p: "80" }), "p")).toBe(80);
    expect(getPercent(form({ p: "12,5" }), "p")).toBe(12.5);
    expect(getPercent(form({ p: "" }), "p", { fallback: 100 })).toBe(100);
  });

  it("limita a 0–100", () => {
    expect(() => getPercent(form({ p: "120" }), "p")).toThrow(FormError);
    expect(() => getPercent(form({ p: "-1" }), "p")).toThrow(FormError);
  });
});

describe("getUrl", () => {
  it("acrescenta https:// se faltar", () => {
    expect(getUrl(form({ u: "standvirtual.com/anuncio/123" }), "u")).toBe("https://standvirtual.com/anuncio/123");
    expect(getUrl(form({ u: "" }), "u")).toBeNull();
  });

  it("rejeita esquemas perigosos e texto solto", () => {
    expect(() => getUrl(form({ u: "javascript:alert(1)" }), "u")).toThrow(FormError);
    expect(() => getUrl(form({ u: "não é link" }), "u")).toThrow(FormError);
  });
});

describe("getText", () => {
  it("valida obrigatórios e tamanho", () => {
    expect(getText(form({ t: "  Capacete " }), "t")).toBe("Capacete");
    expect(getText(form({ t: "" }), "t")).toBeNull();
    expect(() => getRequiredText(form({ t: " " }), "t")).toThrow(FormError);
    expect(() => getText(form({ t: "x".repeat(10) }), "t", { max: 5 })).toThrow(FormError);
  });
});

describe("getEnum", () => {
  it("aceita só valores conhecidos", () => {
    expect(getEnum(form({ k: "invested" }), "k", ["available", "invested"] as const, "available")).toBe("invested");
    expect(getEnum(form({ k: "hack" }), "k", ["available", "invested"] as const, "available")).toBe("available");
  });
});

describe("getMoney obrigatório / getOptionalMoney", () => {
  it("distingue vazio de zero", async () => {
    const { getOptionalMoney } = await import("./forms");
    expect(() => getMoney(form({ v: "" }), "v", { required: true })).toThrow(FormError);
    expect(getMoney(form({ v: "0" }), "v", { required: true })).toBe(0);
    expect(getOptionalMoney(form({ v: "" }), "v")).toBeNull();
    expect(getOptionalMoney(form({ v: "12,5" }), "v")).toBe(12.5);
  });
});
