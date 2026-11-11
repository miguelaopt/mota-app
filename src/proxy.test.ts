import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeSession, SESSION_HEADER } from "@/lib/session-header";

let claims: { sub: string; email?: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) },
  }),
}));

const { proxy } = await import("./proxy");

const forwarded = (res: Response) => decodeSession(res.headers.get(`x-middleware-request-${SESSION_HEADER}`));

describe("proxy", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
  });
  afterEach(() => {
    claims = null;
  });

  it("sem sessão, manda para /login", async () => {
    const res = await proxy(new NextRequest("https://mota.test/contas"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://mota.test/login");
  });

  it("com sessão, passa a sessão validada à página", async () => {
    claims = { sub: "5b9c3f7e-0000-4000-8000-000000000001", email: "eu@mota.pt" };
    const res = await proxy(new NextRequest("https://mota.test/contas"));
    expect(res.status).toBe(200);
    expect(forwarded(res)).toEqual({ sub: claims.sub, email: "eu@mota.pt" });
  });

  it("um cabeçalho forjado pelo browser nunca chega à página", async () => {
    const forged = encodeURIComponent(JSON.stringify({ sub: "00000000-0000-4000-8000-0000000000ff", email: "x@y.z" }));
    // Sem sessão: redireciona e não passa nada.
    const anon = await proxy(new NextRequest("https://mota.test/login", { headers: { [SESSION_HEADER]: forged } }));
    expect(forwarded(anon)).toBeNull();
    // Com sessão: a página recebe a sessão verdadeira, não a forjada.
    claims = { sub: "5b9c3f7e-0000-4000-8000-000000000001" };
    const res = await proxy(new NextRequest("https://mota.test/contas", { headers: { [SESSION_HEADER]: forged } }));
    expect(forwarded(res)?.sub).toBe(claims.sub);
  });
});
