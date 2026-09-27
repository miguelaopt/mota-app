import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseConfig } from "./env";

const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe("getSupabaseConfig", () => {
  it("aceita uma configuração correta", () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" });
    expect(getSupabaseConfig()).toEqual({ ok: true, url: "https://abc.supabase.co", key: "sb_publishable_x" });
  });

  it("aceita a anon key antiga e tira espaços e aspas", () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: ' "https://abc.supabase.co" ', NEXT_PUBLIC_SUPABASE_ANON_KEY: " eyJ " });
    expect(getSupabaseConfig()).toEqual({ ok: true, url: "https://abc.supabase.co", key: "eyJ" });
  });

  it("indica as variáveis em falta", () => {
    setEnv({});
    const config = getSupabaseConfig();
    expect(config.ok).toBe(false);
    if (!config.ok) {
      expect(config.problems).toHaveLength(2);
      expect(config.problems[0]).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(config.problems[1]).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
  });

  it.each([
    ["abc.supabase.co", "https://"],
    ["https://abc.supabase.co/rest/v1", "sem /rest/v1"],
  ])("rejeita o URL %j", (url, hint) => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k" });
    const config = getSupabaseConfig();
    expect(config.ok).toBe(false);
    if (!config.ok) expect(config.problems.join(" ")).toContain(hint);
  });
});
