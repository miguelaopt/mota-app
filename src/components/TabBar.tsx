"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { BriefcaseIcon, ChartIcon, ClipboardIcon, HomeIcon, WalletIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const TABS: Array<{ href: string; label: string; icon: ComponentType<{ size?: number }>; also?: string[] }> = [
  { href: "/", label: "Início", icon: HomeIcon, also: ["/mota", "/definicoes"] },
  { href: "/trabalho", label: "Trabalho", icon: BriefcaseIcon },
  { href: "/contas", label: "Contas", icon: WalletIcon },
  // Planeamento junta Equipamento e Custos (separadores no topo das duas páginas).
  { href: "/equipamento", label: "Planeamento", icon: ClipboardIcon, also: ["/custos"] },
  { href: "/historico", label: "Histórico", icon: ChartIcon },
];

function isActive(pathname: string, href: string, also: string[] = []) {
  if (href === "/") return pathname === "/" || also.some((p) => pathname.startsWith(p));
  return [href, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="tabbar fixed inset-x-0 bottom-0 z-40 border-t border-sep bg-card/85 backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-lg">
        {TABS.map(({ href, label, icon: Icon, also }) => {
          const active = isActive(pathname, href, also);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[0.65rem] font-medium transition-colors",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon size={24} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
