import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession } from "./session-header";

describe("cabeçalho de sessão do proxy", () => {
  it("faz ida e volta", () => {
    const s = { sub: "5b9c3f7e-0000-4000-8000-000000000001", email: "eu@mota.pt" };
    expect(decodeSession(encodeSession(s))).toEqual(s);
  });

  it("rejeita valores inválidos", () => {
    expect(decodeSession(null)).toBeNull();
    expect(decodeSession("lixo")).toBeNull();
    expect(decodeSession(encodeURIComponent(JSON.stringify({ sub: "x' or 1=1" })))).toBeNull();
  });
});
