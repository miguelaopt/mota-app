"use client";

import dynamic from "next/dynamic";

/** O Recharts só é descarregado quando o Histórico abre (o resto da app fica mais leve). */
export const EvolutionChartLazy = dynamic(() => import("./EvolutionChart").then((m) => m.EvolutionChart), {
  ssr: false,
  loading: () => (
    <div aria-hidden>
      <div className="skeleton h-3 w-40 rounded-full" />
      <div className="skeleton mt-2 h-11 rounded-[14px]" />
      <div className="skeleton mt-3 h-48 rounded-xl" />
    </div>
  ),
});
