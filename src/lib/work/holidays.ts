import { dayKey, fromLocalInput } from "@/lib/dates";

/**
 * Feriados de Portugal e acréscimo pago nas horas de trabalho em feriado.
 *
 * Os feriados nacionais obrigatórios são calculados para qualquer ano (a Páscoa
 * muda todos os anos). O Carnaval não é obrigatório e o feriado municipal
 * depende do concelho: ambos ficam nas definições do trabalho.
 */

export interface HolidayRules {
  /** Acréscimo por hora em feriado, em pontos base: 5000 = +50%, 10000 = a dobrar. */
  premiumBp: number;
  /** Feriado municipal, "MM-DD" (ex.: "06-13" em Lisboa). */
  municipal: string | null;
  /** O Carnaval é feriado no trabalho. */
  carnival: boolean;
}

export const DEFAULT_HOLIDAY_RULES: HolidayRules = { premiumBp: 5000, municipal: null, carnival: false };

const FIXED: Record<string, string> = {
  "01-01": "Ano Novo",
  "04-25": "Dia da Liberdade",
  "05-01": "Dia do Trabalhador",
  "06-10": "Dia de Portugal",
  "08-15": "Assunção de Nossa Senhora",
  "10-05": "Implantação da República",
  "11-01": "Todos os Santos",
  "12-01": "Restauração da Independência",
  "12-08": "Imaculada Conceição",
  "12-25": "Natal",
};

/** Domingo de Páscoa (calendário gregoriano), "AAAA-MM-DD". */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" ± dias. */
export function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const cache = new Map<string, Map<string, string>>();

/** Feriados de um ano com estas regras: dia → nome. */
export function holidaysOfYear(year: number, rules: Pick<HolidayRules, "municipal" | "carnival">): Map<string, string> {
  const cacheKey = `${year}|${rules.municipal ?? ""}|${rules.carnival}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const days = new Map<string, string>();
  for (const [md, name] of Object.entries(FIXED)) days.set(`${year}-${md}`, name);
  const easter = easterSunday(year);
  days.set(addDaysToKey(easter, -2), "Sexta-feira Santa");
  days.set(easter, "Páscoa");
  days.set(addDaysToKey(easter, 60), "Corpo de Deus");
  if (rules.carnival) days.set(addDaysToKey(easter, -47), "Carnaval");
  if (rules.municipal && !days.has(`${year}-${rules.municipal}`)) days.set(`${year}-${rules.municipal}`, "Feriado municipal");

  cache.set(cacheKey, days);
  return days;
}

/** Nome do feriado nesse dia ("AAAA-MM-DD"), ou null. */
export function holidayName(key: string, rules: Pick<HolidayRules, "municipal" | "carnival">): string | null {
  return holidaysOfYear(Number(key.slice(0, 4)), rules).get(key) ?? null;
}

/** Feriado no dia (hora de Lisboa) deste instante, ou null. */
export function holidayAt(at: number, rules: Pick<HolidayRules, "municipal" | "carnival">): string | null {
  return holidayName(dayKey(new Date(at)), rules);
}

/** Início do dia em Lisboa (meia-noite local) em ms. */
function dayStart(key: string): number {
  return fromLocalInput(`${key}T00:00`)!.getTime();
}

/** Tempo de [start, end) que cai em feriados (dias de Lisboa). */
function holidayOverlapMs(start: number, end: number, rules: HolidayRules, minus: Array<[number, number]> = []): number {
  if (end <= start) return 0;
  let total = 0;
  const last = dayKey(new Date(end - 1));
  for (let key = dayKey(new Date(start)); key <= last; key = addDaysToKey(key, 1)) {
    if (!holidayName(key, rules)) continue;
    const from = Math.max(start, dayStart(key));
    const to = Math.min(end, dayStart(addDaysToKey(key, 1)));
    if (to <= from) continue;
    let ms = to - from;
    // Pausas não pagas dentro deste bocado do feriado não contam.
    for (const [bs, be] of minus) ms -= Math.max(0, Math.min(to, be) - Math.max(from, bs));
    total += Math.max(0, ms);
  }
  return total;
}

/**
 * Tempo pago que cai em feriados: do início à saída (ou a agora), sem as
 * pausas não pagas. É sobre este tempo que se paga o acréscimo.
 */
export function holidayPaidMs(
  shift: { startedAt: number; endedAt: number | null; breaks: Array<{ startedAt: number; endedAt: number | null; paid: boolean }> },
  now: number,
  rules: HolidayRules,
): number {
  const end = shift.endedAt ?? now;
  const unpaid = shift.breaks
    .filter((b) => !b.paid)
    .map((b): [number, number] => [Math.max(b.startedAt, shift.startedAt), Math.min(b.endedAt ?? end, end)])
    .filter(([s, e]) => e > s);
  return holidayOverlapMs(shift.startedAt, end, rules, unpaid);
}

/**
 * Para um turno planeado (sem pausas marcadas): parte do tempo pago em feriado,
 * proporcional ao tempo do turno que cai no feriado.
 */
export function plannedHolidayPaidMs(plan: { startsAt: number; endsAt: number }, paidMs: number, rules: HolidayRules): number {
  const total = plan.endsAt - plan.startsAt;
  if (total <= 0 || paidMs <= 0) return 0;
  return Math.round((holidayOverlapMs(plan.startsAt, plan.endsAt, rules) / total) * paidMs);
}

/** "+50%" (pontos base → percentagem legível). */
export function formatPremium(bp: number): string {
  return `+${String(Math.round(bp) / 100).replace(".", ",")}%`;
}

/** "13/06" → "06-13" (null se vazio; lança se inválido). */
export function parseMunicipalHoliday(input: string): string | null | undefined {
  const text = input.trim();
  if (!text) return null;
  const m = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})$/.exec(text);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || day < 1) return undefined;
  // Ano bissexto como referência, para aceitar 29/02.
  if (day > new Date(Date.UTC(2024, month, 0)).getUTCDate()) return undefined;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "06-13" → "13/06". */
export function formatMunicipalHoliday(md: string | null): string {
  return md ? `${md.slice(3)}/${md.slice(0, 2)}` : "";
}
