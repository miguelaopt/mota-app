import { applyWorkOp, type ClockShift, type CompletedClockShift, type WorkOp } from "./clock";

/**
 * Estado do relógio de ponto no telemóvel.
 *
 * Picar entrada, pausas e saída são aplicados logo aqui e guardados no
 * localStorage, por isso funcionam offline e sobrevivem a fechar a app ou
 * reiniciar o telemóvel. As operações ficam numa fila e são enviadas ao
 * servidor por ordem; cada uma tem ids próprios, por isso reenviar não duplica.
 */

export interface ClockStoreState {
  v: 1;
  userId: string;
  active: ClockShift | null;
  lastCompleted: CompletedClockShift | null;
  /** Resumo já fechado pelo utilizador (não volta a aparecer). */
  dismissedCompletedId: string | null;
  /** Operações ainda por enviar ao servidor. */
  ops: WorkOp[];
  /** Hora do servidor da última operação aceite (para não aplicar páginas antigas da cache). */
  ackAt: number;
  error: string | null;
}

export type SendResult = { ok: true; at: number } | { ok: false; error: string; retry: boolean };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEY = "mota.work.clock.v1";

export interface ClockStore {
  getState(): ClockStoreState | null;
  subscribe(listener: () => void): () => void;
  /** Junta o estado vindo do servidor (página renderizada em `renderedAt`). */
  syncFromServer(userId: string, serverActive: ClockShift | null, renderedAt: number): void;
  /** Aplica uma operação localmente e põe-na na fila. Devolve o erro, se houver. */
  dispatch(op: WorkOp): string | null;
  /** Envia a fila ao servidor. Devolve true se ficou vazia. */
  flush(): Promise<boolean>;
  dismissCompleted(): void;
  clearError(): void;
  /** Recarrega do armazenamento (alterações noutro separador). */
  reload(): void;
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createClockStore({
  storage,
  send,
  onResync,
}: {
  storage: () => StorageLike | null;
  send: (op: WorkOp) => Promise<SendResult>;
  /** Chamado quando o estado local foi descartado e é preciso reler o servidor. */
  onResync?: () => void;
}): ClockStore {
  let state: ClockStoreState | null = null;
  let loaded = false;
  let flushing: Promise<boolean> | null = null;
  const listeners = new Set<() => void>();

  const read = (): ClockStoreState | null => {
    try {
      const raw = storage()?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ClockStoreState;
      return parsed?.v === 1 && Array.isArray(parsed.ops) ? parsed : null;
    } catch {
      return null;
    }
  };

  const load = () => {
    if (loaded) return;
    loaded = true;
    state = read();
  };

  const set = (next: ClockStoreState) => {
    state = next;
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sem espaço ou modo privado: continua só em memória.
    }
    for (const listener of listeners) listener();
  };

  const store: ClockStore = {
    getState() {
      load();
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    syncFromServer(userId, serverActive, renderedAt) {
      load();
      if (!state || state.userId !== userId) {
        set({
          v: 1,
          userId,
          active: serverActive,
          lastCompleted: null,
          dismissedCompletedId: null,
          ops: [],
          ackAt: renderedAt,
          error: null,
        });
        return;
      }
      // Com operações por enviar, o estado local é o mais recente. Uma página
      // anterior à última operação aceite (ex.: vinda da cache offline) também
      // não pode sobrepor-se.
      if (state.ops.length > 0 || renderedAt < state.ackAt) return;
      if (!same(state.active, serverActive)) set({ ...state, active: serverActive, ackAt: renderedAt });
    },

    dispatch(op) {
      load();
      if (!state) return "A app ainda está a carregar. Tenta outra vez.";
      const result = applyWorkOp({ active: state.active, lastCompleted: state.lastCompleted }, op);
      if (!result.ok) {
        set({ ...state, error: result.error });
        return result.error;
      }
      // Operação repetida (ex.: duplo toque): o estado não muda e não vai para a fila.
      if (same(result.state.active, state.active) && same(result.state.lastCompleted, state.lastCompleted)) return null;
      set({ ...state, ...result.state, ops: [...state.ops, op], error: null });
      void store.flush();
      return null;
    },

    flush() {
      // Um envio já em curso pode ter começado sem rede: tenta outra vez a seguir.
      if (flushing) return flushing.then(() => store.flush());
      const run = async (): Promise<boolean> => {
        while (state && state.ops.length > 0) {
          const op = state.ops[0];
          let result: SendResult;
          try {
            result = await send(op);
          } catch {
            return false; // sem rede: fica na fila
          }
          if (!state) return false;
          if (result.ok) {
            set({ ...state, ops: state.ops.slice(1), ackAt: Math.max(state.ackAt, result.at), error: null });
          } else if (result.retry) {
            set({ ...state, error: result.error });
            return false;
          } else {
            // Operação rejeitada: descarta a fila e volta ao estado do servidor.
            set({ ...state, ops: [], ackAt: 0, error: `${result.error} O estado foi atualizado a partir do servidor.` });
            onResync?.();
            return false;
          }
        }
        return true;
      };
      // O finally corre depois desta atribuição, mesmo que a fila esteja vazia.
      const promise = run().finally(() => {
        if (flushing === promise) flushing = null;
      });
      flushing = promise;
      return promise;
    },

    dismissCompleted() {
      if (state?.lastCompleted) set({ ...state, dismissedCompletedId: state.lastCompleted.id });
    },

    clearError() {
      if (state?.error) set({ ...state, error: null });
    },

    reload() {
      const next = read();
      if (next && !same(next, state)) {
        state = next;
        for (const listener of listeners) listener();
      }
    },
  };

  return store;
}
