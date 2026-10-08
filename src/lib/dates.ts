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

const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

/** "março de 2027" */
export function formatMonthYear(value: Date | string): string {
  return monthYear.format(toDate(value));
}

/** "15 de março" (ou "15 de março de 2025" se não for do ano de `now`). */
export function formatShortDate(value: Date | string, now: Date = new Date()): string {
  const date = toDate(value);
  return dayKey(date).slice(0, 4) === dayKey(now).slice(0, 4) ? dayMonth.format(date) : dayMonthYear.format(date);
}

export function formatTime(value: Date | string | number): string {
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

const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wallParts(date: Date): Record<"year" | "month" | "day" | "hour" | "minute" | "second", number> {
  const parts = Object.fromEntries(wallClock.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Diferença (ms) entre a hora de Lisboa e UTC num dado instante (0 no inverno, 1 h no verão). */
function lisbonOffsetMs(instant: number): number {
  const p = wallParts(new Date(instant));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Valor para um <input type="datetime-local">, na hora de Lisboa: "2026-10-08T18:30". */
export function toLocalInput(value: Date | string | number): string {
  const p = wallParts(toDate(value));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Interpreta "2026-10-08T18:30" como hora de Lisboa e devolve o instante (UTC).
 * Na hora que se repete quando o relógio atrasa, escolhe a primeira.
 * Devolve null se o texto não for válido.
 */
export function fromLocalInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map((v) => Number(v ?? 0));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  if (new Date(wall).getUTCDate() !== day) return null;
  // O desvio de Lisboa é o de antes ou o de depois de uma eventual mudança de hora.
  const offsets = [lisbonOffsetMs(wall - 6 * 60 * 60 * 1000), lisbonOffsetMs(wall + 6 * 60 * 60 * 1000)];
  const valid = offsets.map((offset) => wall - offset).filter((t) => lisbonOffsetMs(t) === wall - t);
  // Hora repetida (o relógio atrasa): a primeira. Hora inexistente (adianta): desvio de antes.
  return new Date(valid.length > 0 ? Math.min(...valid) : wall - offsets[0]);
}

const weekdayShort = fmt({ weekday: "short", day: "numeric", month: "short" });

/** "Hoje", "Amanhã" ou "qui., 9 de out." para planear turnos. */
export function formatShiftDay(value: Date | number, now: Date = new Date()): string {
  const date = toDate(value);
  const days = daysBetween(dayKey(now), dayKey(date));
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === -1) return "Ontem";
  return weekdayShort.format(date);
}
