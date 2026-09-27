import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sem ligação" };

export default function OfflinePage() {
  return (
    <main className="app-main flex min-h-dvh flex-col items-center justify-center text-center">
      <p className="text-5xl" aria-hidden>
        📡
      </p>
      <h1 className="mt-4 text-2xl font-bold">Sem ligação</h1>
      <p className="mt-2 max-w-xs text-muted">
        Esta página ainda não está guardada no telemóvel. Liga-te à internet para veres os teus dados atualizados.
      </p>
    </main>
  );
}
