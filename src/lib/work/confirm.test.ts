import { describe, expect, it } from "vitest";
import { buildConfirmData, type ConfirmShift } from "./confirm";

const H = 3600_000;
const now = new Date("2026-11-11T13:00:00Z");
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

const shift = (id: string, startIso: string, attributionId: string | null = null): ConfirmShift => ({
  id,
  startedAt: Date.parse(startIso),
  endedAt: Date.parse(startIso) + 5 * H,
  plannedEndAt: null,
  breaks: [],
  hourlyRateCents: 472,
  allocationBp: 10000,
  attributionId,
});

const accounts = [
  { id: "tr", name: "Trade Republic", balanceCents: 100000, balanceUpdatedAt: "2026-11-01T10:00:00Z", archived: false },
  { id: "rev", name: "Revolut", balanceCents: 105000, balanceUpdatedAt: "2026-11-09T10:00:00Z", archived: false },
  { id: "old", name: "Antiga", balanceCents: 0, balanceUpdatedAt: null, archived: true },
];

describe("buildConfirmData", () => {
  const shifts = [
    shift("s1", "2026-11-01T18:30:00Z"),
    shift("s2", "2026-11-02T18:30:00Z"),
    shift("s0", "2026-10-20T18:30:00Z", "a1"), // já confirmado
  ];

  it("soma só os turnos por confirmar (5 h a 4,72 €/h = 23,60 € cada)", () => {
    const d = buildConfirmData({ shifts, accounts, snapshots: [], attributions: [], now });
    expect(d.pending.map((p) => p.id)).toEqual(["s1", "s2"]);
    expect(d.pendingCents).toBe(4720);
    expect(d.accounts.map((a) => a.id)).toEqual(["tr", "rev"]);
  });

  it("o primeiro saldo de uma conta não conta como aumento", () => {
    const d = buildConfirmData({
      shifts,
      accounts,
      snapshots: [{ id: 1, accountId: "rev", recordedAt: day("2026-11-09"), balanceCents: 105000 }],
      attributions: [],
      now,
    });
    expect(d.accounts.find((a) => a.id === "rev")!.increases).toEqual([]);
  });

  it("sugere «já atualizei» na conta com um aumento recente que cobre o valor", () => {
    const d = buildConfirmData({
      shifts,
      accounts,
      snapshots: [
        { id: 1, accountId: "rev", recordedAt: day("2026-10-01"), balanceCents: 100000 },
        { id: 2, accountId: "rev", recordedAt: day("2026-11-09"), balanceCents: 105000 },
      ],
      attributions: [],
      now,
    });
    expect(d.suggestedAccountId).toBe("rev");
    expect(d.suggestedAlreadyUpdated).toBe(true);
    expect(d.accounts.find((a) => a.id === "rev")!.increases[0]).toMatchObject({ snapshotId: 2, increaseCents: 5000, availableCents: 5000 });
  });

  it("desconta o que já foi atribuído e não sugere aumentos que não chegam", () => {
    const d = buildConfirmData({
      shifts,
      accounts,
      snapshots: [
        { id: 1, accountId: "rev", recordedAt: day("2026-10-01"), balanceCents: 100000 },
        { id: 2, accountId: "rev", recordedAt: day("2026-11-09"), balanceCents: 105000 },
      ],
      attributions: [{ snapshotId: 2, amountCents: 3000 }],
      now,
    });
    expect(d.accounts.find((a) => a.id === "rev")!.increases[0].availableCents).toBe(2000);
    // 20 € disponíveis não cobrem 47,20 €: sugere atualizar o saldo, na conta mais recente.
    expect(d.suggestedAlreadyUpdated).toBe(false);
    expect(d.suggestedAccountId).toBe("rev");
  });

  it("ignora aumentos antigos (mais de 60 dias)", () => {
    const d = buildConfirmData({
      shifts,
      accounts,
      snapshots: [
        { id: 1, accountId: "tr", recordedAt: day("2026-07-01"), balanceCents: 50000 },
        { id: 2, accountId: "tr", recordedAt: day("2026-08-01"), balanceCents: 100000 },
      ],
      attributions: [],
      now,
    });
    expect(d.accounts.find((a) => a.id === "tr")!.increases).toEqual([]);
  });
});
