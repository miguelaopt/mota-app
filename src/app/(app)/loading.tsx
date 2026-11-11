/**
 * Mostrado logo ao tocar num separador, enquanto o servidor prepara a página:
 * a tab bar fica no sítio e o ecrã responde de imediato.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5 pt-2">
      <span className="sr-only">A carregar…</span>
      <div className="space-y-2.5 px-1 pt-1">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-9 w-44 rounded-xl" />
      </div>
      <div className="glass space-y-4 rounded-[22px] p-5">
        <div className="skeleton h-3 w-28 rounded-full" />
        <div className="skeleton h-10 w-40 rounded-xl" />
        <div className="skeleton h-2.5 w-full rounded-full" />
        <div className="flex gap-3">
          <div className="skeleton h-3 w-20 rounded-full" />
          <div className="skeleton h-3 w-16 rounded-full" />
        </div>
      </div>
      <div className="glass divide-y divide-sep rounded-[22px]">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3 px-4 py-4">
            <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-2/3 rounded-full" />
              <div className="skeleton h-2.5 w-1/3 rounded-full" />
            </div>
            <div className="skeleton h-4 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
