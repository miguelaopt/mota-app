import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("resolve conflitos do Tailwind a favor da última classe", () => {
    expect(cn("rounded-2xl bg-card p-4", "p-0")).toBe("rounded-2xl bg-card p-0");
    expect(cn("p-4", "py-2")).toBe("p-4 py-2");
    expect(cn("text-muted", false, "text-accent")).toBe("text-accent");
  });

  it("mantém cores personalizadas do tema", () => {
    expect(cn("bg-card", "bg-accent-soft")).toBe("bg-accent-soft");
    expect(cn("text-sm", "text-muted")).toBe("text-sm text-muted");
  });
});
