import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sem ligação" };

export default function OfflinePage() {
  return (
    <main className="app-main flex min-h-dvh flex-col items-center justify-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/z400.webp" alt="" width={924} height={540} className="w-64 opacity-60" />
      <h1 className="display mt-4 text-[2rem]">Sem ligação</h1>
      <p className="mt-2 max-w-xs text-muted">
        Esta página ainda não está guardada no telemóvel. Liga-te à internet para veres os teus dados atualizados.
      </p>
    </main>
  );
}
