"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import { DAY_MS, seriesInRange, type EvolutionPoint } from "@/lib/finance/history";
import { formatEur } from "@/lib/finance/money";

export type { EvolutionPoint };

/*
 * Uma só série, por isso sem legenda (o título diz o que é). A linha usa um
 * jade mais fundo, validado para o fundo escuro; o jade néon fica só no ponto
 * de hoje, como destaque do valor atual.
 */
const LINE = "#19a97b";
const NOW_DOT = "#2af5b3";
const SURFACE = "#141619";
const GRID = "rgb(255 255 255 / 0.07)";
const AXIS_TEXT = "#7e8683";

const RANGES = [
  { key: "3m", label: "3 meses", days: 91 },
  { key: "6m", label: "6 meses", days: 182 },
  { key: "1a", label: "1 ano", days: 365 },
  { key: "tudo", label: "Tudo", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const monthShort = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", month: "short" });
const monthYearShort = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", month: "short", year: "2-digit" });

/** Eixo: euros redondos, por extenso abaixo de 10 000 e compactos acima. */
function axisEur(cents: number): string {
  const euros = cents / 100;
  if (Math.abs(euros) >= 10_000) return `${Math.round(euros / 1000)} mil €`;
  return formatEur(Math.round(euros) * 100, { hideZeroCents: true });
}

/** Passo "redondo" para o eixo dos valores. */
function niceStep(span: number, count: number): number {
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].find((n) => n * pow >= raw) ?? 10;
  return unit * pow;
}

function ChartTooltip({ active, payload, now }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }>; now: number }) {
  const point = payload?.[0]?.payload as EvolutionPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2">
      <p className="display text-lg">{formatEur(point.v)}</p>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span className="h-0.5 w-3 rounded-full" style={{ background: LINE }} aria-hidden />
        {point.t >= now - 60_000 ? "hoje" : formatShortDate(new Date(point.t), new Date(now))}
      </p>
    </div>
  );
}

export function EvolutionChart({ points, now }: { points: EvolutionPoint[]; now: number }) {
  const [range, setRange] = useState<RangeKey>("6m");
  const gradientId = useId().replace(/:/g, "");
  const days = RANGES.find((r) => r.key === range)!.days;
  const series = useMemo(() => seriesInRange(points, now, days), [points, now, days]);

  if (points.length < 2) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted">O gráfico aparece quando houver pelo menos duas atualizações de saldo.</p>
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const change = last.v - first.v;
  const values = series.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep(Math.max(max - Math.min(0, min), 100_00), 3);
  const yMin = min >= 0 ? 0 : Math.floor(min / step) * step;
  const yMax = Math.ceil(max / step) * step || step;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1; v += step) ticks.push(v);
  const spanDays = (last.t - first.t) / DAY_MS;
  const tickFormat = (t: number) => (spanDays > 330 ? monthYearShort : monthShort).format(new Date(t)).replace(".", "");
  const rangeLabel = days == null ? "desde o início" : `nos últimos ${RANGES.find((r) => r.key === range)!.label}`;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 px-1">
        <p className="text-[0.8125rem] text-muted tabular-nums">
          <span className={cn("font-semibold", change > 0 && "text-fg", change < 0 && "text-danger")}>
            {formatEur(change, { signed: true, hideZeroCents: true })}
          </span>{" "}
          {rangeLabel}
        </p>
      </div>

      <div
        className="mt-2 flex gap-1 rounded-[14px] border border-glass-border bg-card-2 p-1"
        role="radiogroup"
        aria-label="Intervalo do gráfico"
      >
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={range === r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "min-h-9 flex-1 rounded-[10px] text-xs font-semibold transition-colors",
              range === r.key ? "bg-white/[0.1] text-fg" : "text-muted active:opacity-70",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div
        className="mt-3 h-48"
        role="img"
        aria-label={`Evolução do total que conta para a mota: de ${formatEur(first.v)} para ${formatEur(last.v)} ${rangeLabel}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity={0.14} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[first.t, last.t]}
              tickFormatter={tickFormat}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={24}
              tickCount={5}
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={ticks}
              tickFormatter={axisEur}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={62}
            />
            <Tooltip
              content={(props) => <ChartTooltip active={props.active} payload={props.payload} now={now} />}
              cursor={{ stroke: "rgb(255 255 255 / 0.25)", strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              type="linear"
              dataKey="v"
              stroke={LINE}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              activeDot={{ r: 5, fill: NOW_DOT, stroke: SURFACE, strokeWidth: 2 }}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === series.length - 1 && props.cx != null && props.cy != null ? (
                  <circle key="hoje" cx={props.cx} cy={props.cy} r={4.5} fill={NOW_DOT} stroke={SURFACE} strokeWidth={2} />
                ) : (
                  <g key={`p${props.index}`} />
                )
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-1 px-1">
        <summary className="cursor-pointer py-2 text-xs font-medium text-muted">Ver valores em tabela</summary>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="py-1 font-medium">Data</th>
              <th className="py-1 text-right font-medium">Conta para a mota</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((p) => (
              <tr key={p.t} className="border-t border-sep">
                <td className="py-1.5 text-muted">{p.t >= now - 60_000 ? "Hoje" : formatShortDate(new Date(p.t), new Date(now))}</td>
                <td className="py-1.5 text-right">{formatEur(p.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
