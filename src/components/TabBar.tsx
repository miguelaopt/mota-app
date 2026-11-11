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
    <nav aria-label="Navegação principal" className="tabbar glass-strong fixed z-40 mx-auto max-w-lg rounded-[26px]">
      <ul className="grid h-[var(--tabbar-h)] grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, also }) => {
          const active = isActive(pathname, href, also);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.65rem] transition-colors",
                  active ? "font-semibold text-accent" : "font-medium text-faint active:text-muted",
                )}
              >
                {active && <span className="absolute top-1.5 h-1 w-5 rounded-full bg-accent shadow-[0_0_10px_rgb(42_245_179/0.7)]" aria-hidden />}
                <Icon size={23} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
