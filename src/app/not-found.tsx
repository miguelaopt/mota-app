import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="app-main mx-auto flex min-h-dvh max-w-lg flex-col justify-center">
      <div className="glass rounded-3xl p-6">
        <p className="eyebrow">Erro 404</p>
        <h1 className="display mt-1 text-4xl">Não encontrado</h1>
        <p className="mt-2 text-muted">Esta página não existe ou já foi apagada (por exemplo, um turno que removeste).</p>
        <Link href="/" className={buttonClass("primary", "md", "mt-5 w-full")}>
          Voltar ao Início
        </Link>
      </div>
    </main>
  );
}
