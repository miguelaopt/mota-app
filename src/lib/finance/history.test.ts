import { describe, expect, it } from "vitest";
import { computeSavingsRate, totalAt, totalSeries, type BalanceSnapshot } from "./history";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

const snap = (accountId: string, iso: string, balanceCents: number, extra: Partial<BalanceSnapshot> = {}): BalanceSnapshot => ({
  accountId,
  recordedAt: day(iso),
  balanceCents,
  kind: "available",
  countPct: 100,
  safetyMarginPct: 100,
  ...extra,
});

describe("totalAt", () => {
  const snapshots = [
    snap("a", "2026-01-01", 100000),
    snap("b", "2026-01-15", 50000, { kind: "invested", safetyMarginPct: 80 }),
    snap("a", "2026-02-01", 120000),
  ];

  it("soma o último registo de cada conta até à data", () => {
    expect(totalAt(snapshots, day("2025-12-31"))).toBe(0);
    expect(totalAt(snapshots, day("2026-01-10"))).toBe(100000);
    expect(totalAt(snapshots, day("2026-01-20"))).toBe(140000);
    expect(totalAt(snapshots, day("2026-03-01"))).toBe(160000);
  });

  it("não depende da ordem de entrada", () => {
    expect(totalAt([...snapshots].reverse(), day("2026-03-01"))).toBe(160000);
  });
});

describe("totalSeries", () => {
  it("gera a evolução do total juntado", () => {
    const series = totalSeries([
      snap("a", "2026-01-01", 100000),
      snap("b", "2026-01-15", 50000),
      snap("a", "2026-02-01", 80000),
    ]);
    expect(series.map((p) => p.totalCents)).toEqual([100000, 150000, 130000]);
  });

  it("junta registos no mesmo instante", () => {
    const series = totalSeries([snap("a", "2026-01-01", 100), snap("b", "2026-01-01", 200)]);
    expect(series).toHaveLength(1);
    expect(series[0].totalCents).toBe(300);
  });
});

describe("computeSavingsRate", () => {
  it("devolve null sem histórico", () => {
    expect(computeSavingsRate([], day("2026-06-01"))).toBeNull();
  });

  it("devolve null com menos de 30 dias de histórico", () => {
    const snapshots = [snap("a", "2026-05-15", 100000), snap("a", "2026-06-01", 130000)];
    expect(computeSavingsRate(snapshots, day("2026-06-01"))).toBeNull();
  });

  it("os saldos iniciais não contam como poupança", () => {
    // Conta criada com 1.000 € e atualizada 2 meses depois para 1.600 €: 300 €/mês
    const snapshots = [snap("a", "2026-01-01", 100000), snap("a", "2026-03-02", 160000)];
    const rate = computeSavingsRate(snapshots, day("2026-03-02"))!;
    expect(rate.days).toBe(60);
    expect(rate.centsPerMonth).toBeCloseTo(60000 / (60 / 30.4375), 6);
  });

  it("uma conta nova com dinheiro não inflaciona o ritmo", () => {
    const snapshots = [
      snap("a", "2026-01-01", 100000),
      snap("a", "2026-03-02", 160000),
      // conta adicionada mais tarde, já com 5.000 €
      snap("b", "2026-02-15", 500000),
    ];
    const rate = computeSavingsRate(snapshots, day("2026-03-02"))!;
    expect(rate.centsPerMonth).toBeCloseTo(60000 / (60 / 30.4375), 6);
  });

  it("usa só a janela dos últimos meses", () => {
    const snapshots = [
      snap("a", "2025-01-01", 0),
      snap("a", "2025-06-01", 1000000), // subida grande antiga
      snap("a", "2026-06-01", 1120000),
    ];
    const now = day("2026-06-01");
    const rate = computeSavingsRate(snapshots, now, { windowMonths: 6 })!;
    // Na janela de 6 meses, subiu 1.200 € → 200 €/mês
    expect(rate.centsPerMonth).toBeCloseTo(20000, 0);
    expect(Math.round(rate.days)).toBe(183);
  });

  it("aplica percentagens e margens do momento do registo", () => {
    const snapshots = [
      snap("t212", "2026-01-01", 100000, { kind: "invested", safetyMarginPct: 80 }),
      snap("t212", "2026-03-02", 200000, { kind: "invested", safetyMarginPct: 80 }),
    ];
    const rate = computeSavingsRate(snapshots, day("2026-03-02"))!;
    // 800 € → 1.600 € (contados) em 60 dias
    expect(rate.centsPerMonth).toBeCloseTo(80000 / (60 / 30.4375), 6);
  });

  it("pode ser negativo", () => {
    const snapshots = [snap("a", "2026-01-01", 100000), snap("a", "2026-03-02", 40000)];
    expect(computeSavingsRate(snapshots, day("2026-03-02"))!.centsPerMonth).toBeLessThan(0);
  });

  it("ignora registos no futuro", () => {
    const snapshots = [snap("a", "2026-01-01", 100000), snap("a", "2026-03-02", 160000), snap("a", "2026-05-01", 999999)];
    const rate = computeSavingsRate(snapshots, day("2026-03-02"))!;
    expect(rate.centsPerMonth).toBeCloseTo(60000 / (60 / 30.4375), 6);
  });
});
