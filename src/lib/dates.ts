/** Datas mostradas sempre na hora de Portugal continental (o servidor corre em UTC). */
export const TIME_ZONE = "Europe/Lisbon";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmt(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-PT", { timeZone: TIME_ZONE, ...options });
}

const monthYear = fmt({ month: "long", year: "numeric" });
const dayMonth = fmt({ day: "numeric", month: "long" });
const dayMonthYear = fmt({ day: "numeric", month: "long", year: "numeric" });
const weekdayDayMonth = fmt({ weekday: "long", day: "numeric", month: "long" });
const time = fmt({ hour: "2-digit", minute: "2-digit" });
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

const toDate = (value: Date | string) => (typeof value === "string" ? new Date(value) : value);

/** "março de 2027" */
export function formatMonthYear(value: Date | string): string {
  return monthYear.format(toDate(value));
}

/** "15 de março" (ou "15 de março de 2025" se não for do ano de `now`). */
export function formatShortDate(value: Date | string, now: Date = new Date()): string {
  const date = toDate(value);
  return dayKey(date).slice(0, 4) === dayKey(now).slice(0, 4) ? dayMonth.format(date) : dayMonthYear.format(date);
}

export function formatTime(value: Date | string): string {
  return time.format(toDate(value));
}

/** Dia civil em Lisboa, "2026-09-27" (para agrupar). */
export function dayKey(value: Date | string): string {
  return isoDay.format(toDate(value));
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / DAY_MS);
}

/** "hoje", "ontem", "há 3 dias", "há 2 meses", "há mais de um ano" */
export function formatRelative(value: Date | string, now: Date = new Date()): string {
  const days = daysBetween(dayKey(value), dayKey(now));
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30.4375);
  if (months <= 1) return "há 1 mês";
  if (months < 12) return `há ${months} meses`;
  return days < 730 ? "há mais de um ano" : `há ${Math.floor(days / 365.25)} anos`;
}

/** Título de um dia no histórico: "Hoje", "Ontem", "segunda-feira, 15 de março". */
export function formatDayHeading(key: string, now: Date = new Date()): string {
  const days = daysBetween(key, dayKey(now));
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  const date = new Date(`${key}T12:00:00Z`);
  const sameYear = key.slice(0, 4) === dayKey(now).slice(0, 4);
  return sameYear ? weekdayDayMonth.format(date) : dayMonthYear.format(date);
}

/** "daqui a 3 meses", "daqui a 1 ano e 2 meses" */
export function formatDuration(months: number): string {
  const total = Math.max(0, Math.ceil(months));
  if (total === 0) return "este mês";
  const years = Math.floor(total / 12);
  const rest = total % 12;
  const parts: string[] = [];
  if (years) parts.push(years === 1 ? "1 ano" : `${years} anos`);
  if (rest) parts.push(rest === 1 ? "1 mês" : `${rest} meses`);
  return `daqui a ${parts.join(" e ")}`;
}
