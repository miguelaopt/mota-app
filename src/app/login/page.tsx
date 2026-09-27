import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { erro } = await searchParams;
  return (
    <main className="app-main flex min-h-dvh flex-col justify-center">
      <div className="mx-auto w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={72} height={72} className="mx-auto rounded-2xl shadow-sm" />
        <h1 className="mt-5 text-center text-3xl font-bold tracking-tight">Mota</h1>
        <p className="mt-1 text-center text-muted">Cada euro conta.</p>
        <LoginForm linkError={erro === "link"} />
      </div>
    </main>
  );
}
