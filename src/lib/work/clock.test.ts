import { describe, expect, it } from "vitest";
import { applyWorkOp, parseWorkOp, type ClockShift, type WorkOp } from "./clock";
import { createClockStore, type SendResult, type StorageLike } from "./clock-store";

const SHIFT_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const BREAK_ID = "bbbbbbbb-0000-4000-8000-000000000001";
const T0 = Date.parse("2026-10-08T17:30:00Z");

const shift: ClockShift = {
  id: SHIFT_ID,
  startedAt: T0,
  plannedEndAt: T0 + 5 * 3600_000,
  scheduledShiftId: null,
  motorcycleId: null,
  payMode: "hourly",
  hourlyRateCents: 550,
  allocationBp: 7000,
  target: "minimum",
  breaks: [],
};

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function fakeServer() {
  const received: WorkOp[] = [];
  let online = true;
  let reject: string | null = null;
  return {
    received,
    setOnline: (v: boolean) => (online = v),
    rejectNext: (msg: string) => (reject = msg),
    send: async (op: WorkOp): Promise<SendResult> => {
      if (!online) throw new TypeError("Failed to fetch");
      if (reject) {
        const error = reject;
        reject = null;
        return { ok: false, error, retry: false };
      }
      received.push(op);
      return { ok: true, at: 1000 + received.length };
    },
  };
}

describe("applyWorkOp", () => {
  const empty = { active: null, lastCompleted: null };

  it("não permite dois turnos ativos", () => {
    const first = applyWorkOp(empty, { type: "clock_in", shift });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyWorkOp(first.state, { type: "clock_in", shift: { ...shift, id: "aaaaaaaa-0000-4000-8000-000000000002" } });
    expect(second).toEqual({ ok: false, error: "Já tens um turno a decorrer." });
    // O mesmo pedido repetido não muda nada.
    expect(applyWorkOp(first.state, { type: "clock_in", shift })).toEqual({ ok: true, state: first.state });
  });

  it("picar saída fecha a pausa aberta e repetir não faz nada", () => {
    let s = applyWorkOp(empty, { type: "clock_in", shift });
    if (!s.ok) throw new Error();
    s = applyWorkOp(s.state, { type: "break_start", shiftId: SHIFT_ID, breakId: BREAK_ID, at: T0 + 3600_000, paid: false });
    if (!s.ok) throw new Error();
    s = applyWorkOp(s.state, { type: "clock_out", shiftId: SHIFT_ID, at: T0 + 2 * 3600_000 });
    if (!s.ok) throw new Error();
    expect(s.state.active).toBeNull();
    expect(s.state.lastCompleted?.breaks[0].endedAt).toBe(T0 + 2 * 3600_000);
    const again = applyWorkOp(s.state, { type: "clock_out", shiftId: SHIFT_ID, at: T0 + 3 * 3600_000 });
    expect(again).toEqual({ ok: true, state: s.state });
  });
});

describe("parseWorkOp", () => {
  it("aceita operações válidas e rejeita lixo", () => {
    expect(parseWorkOp({ type: "clock_out", shiftId: SHIFT_ID, at: T0 })).toEqual({ type: "clock_out", shiftId: SHIFT_ID, at: T0 });
    expect(parseWorkOp({ type: "clock_in", shift })).toMatchObject({ type: "clock_in" });
    expect(parseWorkOp({ type: "clock_in", shift: { ...shift, allocationBp: 20000 } })).toBeNull();
    expect(parseWorkOp({ type: "clock_out", shiftId: "x", at: T0 })).toBeNull();
    expect(parseWorkOp({ type: "drop_table" })).toBeNull();
    expect(parseWorkOp("clock_out")).toBeNull();
  });
});

describe("createClockStore", () => {
  it("funciona offline, sobrevive a fechar a app e sincroniza por ordem", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    server.setOnline(false);

    const store = createClockStore({ storage: () => storage, send: server.send });
    store.syncFromServer("u1", null, 1);
    expect(store.dispatch({ type: "clock_in", shift })).toBeNull();
    expect(store.dispatch({ type: "break_start", shiftId: SHIFT_ID, breakId: BREAK_ID, at: T0 + 60_000, paid: false })).toBeNull();
    await store.flush();
    expect(server.received).toHaveLength(0);
    expect(store.getState()?.ops).toHaveLength(2);

    // "Fechar a app": nova instância, mesmo armazenamento.
    const reopened = createClockStore({ storage: () => storage, send: server.send });
    // Uma página antiga (da cache, sem o turno) não apaga o turno local.
    reopened.syncFromServer("u1", null, 1);
    expect(reopened.getState()?.active?.id).toBe(SHIFT_ID);
    expect(reopened.getState()?.active?.breaks).toHaveLength(1);

    reopened.dispatch({ type: "break_end", shiftId: SHIFT_ID, breakId: BREAK_ID, at: T0 + 120_000 });
    reopened.dispatch({ type: "clock_out", shiftId: SHIFT_ID, at: T0 + 3600_000 });
    // Duplo toque: não entra na fila outra vez.
    reopened.dispatch({ type: "clock_out", shiftId: SHIFT_ID, at: T0 + 3600_500 });

    server.setOnline(true);
    expect(await reopened.flush()).toBe(true);
    expect(server.received.map((op) => op.type)).toEqual(["clock_in", "break_start", "break_end", "clock_out"]);
    expect(reopened.getState()?.active).toBeNull();
    expect(reopened.getState()?.lastCompleted?.endedAt).toBe(T0 + 3600_000);
  });

  it("depois de sincronizar, aceita o estado do servidor (ex.: saída noutro dispositivo)", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    const store = createClockStore({ storage: () => storage, send: server.send });
    store.syncFromServer("u1", null, 1);
    store.dispatch({ type: "clock_in", shift });
    await store.flush();
    const ack = store.getState()!.ackAt;
    store.syncFromServer("u1", null, ack - 1); // página anterior: ignorada
    expect(store.getState()?.active?.id).toBe(SHIFT_ID);
    store.syncFromServer("u1", null, ack + 5000); // página nova: turno terminado noutro lado
    expect(store.getState()?.active).toBeNull();
  });

  it("operação rejeitada descarta a fila e pede o estado do servidor", async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    let resynced = false;
    const store = createClockStore({ storage: () => storage, send: server.send, onResync: () => (resynced = true) });
    store.syncFromServer("u1", null, 1);
    server.rejectNext("Já tens um turno a decorrer (talvez noutro dispositivo).");
    store.dispatch({ type: "clock_in", shift });
    await store.flush();
    expect(resynced).toBe(true);
    expect(store.getState()?.ops).toHaveLength(0);
    expect(store.getState()?.error).toMatch(/noutro dispositivo/);
    const other = { ...shift, id: "aaaaaaaa-0000-4000-8000-000000000009" };
    store.syncFromServer("u1", other, 2);
    expect(store.getState()?.active?.id).toBe(other.id);
  });

  it("enviar com a fila vazia termina e não bloqueia envios seguintes", async () => {
    const server = fakeServer();
    const store = createClockStore({ storage: () => memoryStorage(), send: server.send });
    store.syncFromServer("u1", null, 1);
    expect(await store.flush()).toBe(true);
    expect(await store.flush()).toBe(true);
    store.dispatch({ type: "clock_in", shift });
    expect(await store.flush()).toBe(true);
    expect(server.received).toHaveLength(1);
  });

  it("outro utilizador no mesmo telemóvel começa do zero", () => {
    const storage = memoryStorage();
    const store = createClockStore({ storage: () => storage, send: fakeServer().send });
    store.syncFromServer("u1", shift, 1);
    store.syncFromServer("u2", null, 1);
    expect(store.getState()).toMatchObject({ userId: "u2", active: null, ops: [] });
  });
});
