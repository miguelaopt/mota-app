import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SlidersIcon } from "@/components/icons";

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="Mota"
        action={
          <Link href="/definicoes" aria-label="Definições" className="mb-1.5 rounded-full bg-card p-2 text-muted">
            <SlidersIcon size={20} />
          </Link>
        }
      />
      <Card>
        <p>Sessão iniciada. O ecrã de progresso chega nas próximas partes.</p>
      </Card>
    </>
  );
}
