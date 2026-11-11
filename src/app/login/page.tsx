import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { erro } = await searchParams;
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-x-clip px-4 pb-[calc(var(--safe-bottom)+1.5rem)] pt-[calc(var(--safe-top)+1.5rem)]">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(120%_90%_at_60%_30%,#1d2125_0%,#0e1012_60%,#0b0c0e_100%)]"
      />
      <div className="relative mx-auto w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/z400.webp" alt="" width={924} height={540} className="mx-auto w-[88%]" />
        <h1 className="display mt-4 text-center text-[3rem]">Mota</h1>
        <p className="mt-1 text-center text-muted">Cada euro conta.</p>
        <div className="glass mt-7 rounded-[24px] p-5">
          <LoginForm linkError={erro === "link"} />
        </div>
      </div>
    </main>
  );
}
