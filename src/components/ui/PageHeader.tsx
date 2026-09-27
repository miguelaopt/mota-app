import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 pt-2">
      {back && (
        <Link href={back.href} className="-ml-1.5 mb-1 inline-flex items-center text-accent active:opacity-60">
          <ChevronLeftIcon size={24} />
          {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight">{title}</h1>
        {action}
      </div>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </header>
  );
}
