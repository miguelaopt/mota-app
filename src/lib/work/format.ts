import { MINUTE_MS } from "./shift";

/** "2h12", "5h00", "0h45" (minutos arredondados para baixo). */
export function formatHm(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / MINUTE_MS);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** "12 min" abaixo de uma hora, senão "2h12". */
export function formatShortDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / MINUTE_MS);
  return totalMinutes < 60 ? `${totalMinutes} min` : formatHm(ms);
}

/** Timer "2:12:05" (horas sem limite). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Horas inteiras arredondadas para cima, com separador de milhares: "1.247". */
export function formatHoursCeil(hours: number): string {
  return String(Math.ceil(Math.max(0, hours) - 1e-9)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Pontos base → "70%" ou "72,5%". */
export function formatBp(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "").replace(".", ",")}%`;
}
