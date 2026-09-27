"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/Button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-main mx-auto flex min-h-dvh max-w-lg flex-col justify-center">
      <div className="rounded-2xl bg-card p-5">
        <h1 className="text-2xl font-bold">Algo correu mal</h1>
        <p className="mt-2 text-muted">
          Não foi possível carregar esta página. Verifica a ligação à internet e tenta outra vez. Se continuar, confirma no painel do
          Supabase que o projeto está ativo (os projetos gratuitos são pausados ao fim de 7 dias sem uso).
        </p>
        {error.digest && <p className="mt-2 text-xs text-muted">Código do erro: {error.digest}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => retry()} className={buttonClass("primary", "md", "flex-1")}>
            Tentar outra vez
          </button>
          <Link href="/" className={buttonClass("secondary", "md")}>
            Início
          </Link>
        </div>
      </div>
    </main>
  );
}
