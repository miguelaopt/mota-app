"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * Folha que sobe do fundo do ecrã (em ecrãs largos, um modal centrado).
 * O conteúdo só é montado enquanto está aberta, para os formulários
 * recomeçarem sempre com os valores atuais.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Estado pedido pelo pai, para distinguir um fecho do utilizador (Esc,
  // toque fora) de um fecho programático (que não deve voltar a chamar onClose).
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={() => {
        if (openRef.current) onClose();
      }}
      onClick={(event) => {
        // Toque fora do conteúdo (no fundo escurecido) fecha a folha.
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet-safe px-4 pt-2.5">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-track sm:hidden" aria-hidden />
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full bg-card-2 p-1.5 text-muted active:opacity-60">
              <CloseIcon size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
