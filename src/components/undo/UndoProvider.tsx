"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";

/** Tempo para tocar em "Anular" antes de a remoção ir para o servidor. */
export const UNDO_MS = 5000;

type Removal = {
  id: number;
  label: string;
  /** Chaves escondidas enquanto espera (ex.: "cost:<id>"). */
  keys: string[];
  run: () => Promise<ActionResult>;
};

type UndoContextValue = {
  /** Esconde já os itens e só os apaga no servidor se não houver "Anular" em 5 s. */
  remove: (removal: Omit<Removal, "id">) => void;
  hidden: ReadonlySet<string>;
};

const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndo(): UndoContextValue {
  const value = useContext(UndoContext);
  if (!value) throw new Error("useUndo fora do UndoProvider");
  return value;
}

/** Esconde o conteúdo enquanto a remoção espera pelo "Anular". */
export function Removable({ id, children }: { id: string; children: React.ReactNode }) {
  const { hidden } = useUndo();
  return hidden.has(id) ? null : children;
}

let nextId = 1;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Removal[]>([]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const removals = useRef(new Map<number, Removal>());

  const unhide = useCallback((keys: string[]) => {
    setHidden((current) => {
      const next = new Set(current);
      for (const key of keys) next.delete(key);
      return next;
    });
  }, []);

  const commit = useCallback(
    (id: number) => {
      const removal = removals.current.get(id);
      if (!removal) return;
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      removals.current.delete(id);
      setPending((list) => list.filter((r) => r.id !== id));
      startTransition(async () => {
        let result: ActionResult;
        try {
          result = await removal.run();
        } catch {
          result = { ok: false, error: "Sem ligação ao servidor." };
        }
        // A resposta já traz os ecrãs atualizados: só então volta a mostrar as chaves.
        startTransition(() => {
          unhide(removal.keys);
          if (!result?.ok) setError(`Não foi possível remover: ${result?.error ?? "erro desconhecido"}`);
        });
      });
    },
    [unhide],
  );

  const remove = useCallback(
    (input: Omit<Removal, "id">) => {
      const removal = { ...input, id: nextId++ };
      removals.current.set(removal.id, removal);
      setError(null);
      setHidden((current) => new Set([...current, ...removal.keys]));
      setPending((list) => [...list, removal]);
      timers.current.set(
        removal.id,
        setTimeout(() => commit(removal.id), UNDO_MS),
      );
    },
    [commit],
  );

  const undo = (id: number) => {
    const removal = removals.current.get(id);
    if (!removal) return;
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    removals.current.delete(id);
    setPending((list) => list.filter((r) => r.id !== id));
    unhide(removal.keys);
  };

  // A app vai para segundo plano (ou fecha): não deixa remoções por fazer.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") for (const id of [...removals.current.keys()]) commit(id);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [commit]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const value = useMemo(() => ({ remove, hidden }), [remove, hidden]);
  const latest = pending[pending.length - 1];

  return (
    <UndoContext.Provider value={value}>
      {children}
      <div className="toast-dock pointer-events-none fixed z-50 mx-auto max-w-lg" aria-live="polite">
        {latest && (
          <div
            key={latest.id}
            role="status"
            className="toast-in glass-strong pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pl-4 pr-2"
          >
            <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{latest.label}</span>
            {pending.length > 1 && <span className="text-xs text-faint tabular-nums">+{pending.length - 1}</span>}
            <button
              type="button"
              onClick={() => undo(latest.id)}
              className="h-10 shrink-0 rounded-xl border border-accent-line px-3.5 text-sm font-semibold text-accent outline-none active:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent"
            >
              Anular
            </button>
          </div>
        )}
        {!latest && error && (
          <div role="alert" className="toast-in glass-strong pointer-events-auto rounded-2xl px-4 py-3 text-[0.9375rem] text-danger">
            {error}
          </div>
        )}
      </div>
    </UndoContext.Provider>
  );
}

/** Corre uma Server Action de formulário com os campos dados. */
export function formRunner(action: (prev: ActionResult, form: FormData) => Promise<ActionResult>, fields: Record<string, string | number>) {
  return () => {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.set(name, String(value));
    return action(null, form);
  };
}
