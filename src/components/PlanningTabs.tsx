import Link from "next/link";
import { HelmetIcon, ReceiptIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/equipamento", label: "Equipamento", icon: HelmetIcon },
  { href: "/custos", label: "Custos", icon: ReceiptIcon },
] as const;

/** Separadores da secção Planeamento (Equipamento e Custos). */
export function PlanningTabs({ current }: { current: "/equipamento" | "/custos" }) {
  return (
    <nav aria-label="Planeamento" className="mb-4 flex rounded-xl bg-card p-1">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={href === current ? "page" : undefined}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
            href === current ? "bg-accent-soft text-accent" : "text-muted active:opacity-70",
          )}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
