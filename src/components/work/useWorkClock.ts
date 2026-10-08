"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { workOpAction } from "@/app/(app)/trabalho/actions";
import type { ClockShift, ClockState, WorkOp } from "@/lib/work/clock";
import { createClockStore, STORAGE_KEY } from "@/lib/work/clock-store";

let resync: (() => void) | null = null;

/** Um único estado por separador, partilhado pelo Início e pelo ecrã Trabalho. */
const store = createClockStore({
  storage: () => (typeof window === "undefined" ? null : window.localStorage),
  send: (op) => workOpAction(op),
  onResync: () => resync?.(),
});

const getServerSnapshot = () => null;

export interface WorkClock extends ClockState {
  dismissedCompletedId: string | null;
  /** Operações à espera de rede. */
  pendingCount: number;
  error: string | null;
  dispatch: (op: WorkOp) => string | null;
  dismissCompleted: () => void;
  clearError: () => void;
}

export function useWorkClock({
  userId,
  serverActive,
  renderedAt,
}: {
  userId: string;
  serverActive: ClockShift | null;
  renderedAt: number;
}): WorkClock {
  const router = useRouter();
  const state = useSyncExternalStore(store.subscribe, store.getState, getServerSnapshot);
  const pendingCount = state?.userId === userId ? state.ops.length : 0;

  useEffect(() => {
    resync = () => router.refresh();
  }, [router]);

  // Junta o estado da página (servidor) ao local sempre que chega uma página nova.
  useEffect(() => {
    store.syncFromServer(userId, serverActive, renderedAt);
    // serverActive muda sempre com renderedAt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, renderedAt]);

  // Volta a tentar enviar quando há rede, quando a app volta ao ecrã e de tempos a tempos.
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState === "visible") void store.flush();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) store.reload();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("storage", onStorage);
    void store.flush();
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (pendingCount === 0) return;
    const id = window.setInterval(() => void store.flush(), 20_000);
    return () => window.clearInterval(id);
  }, [pendingCount]);

  const local = state?.userId === userId ? state : null;
  return {
    active: local ? local.active : serverActive,
    lastCompleted: local?.lastCompleted ?? null,
    dismissedCompletedId: local?.dismissedCompletedId ?? null,
    pendingCount,
    error: local?.error ?? null,
    dispatch: store.dispatch,
    dismissCompleted: store.dismissCompleted,
    clearError: store.clearError,
  };
}

/**
 * Hora atual que se atualiza a cada `intervalMs` enquanto `active` (só para
 * redesenhar: os valores vêm sempre dos instantes guardados). Começa em
 * `initial` (a hora do servidor) para o HTML inicial coincidir.
 */
export function useNow(active: boolean, initial: number, intervalMs = 1000): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, intervalMs]);
  return now;
}

/** id novo para turnos e pausas (gerado no telemóvel para funcionar offline). */
export function newId(): string {
  return crypto.randomUUID();
}
