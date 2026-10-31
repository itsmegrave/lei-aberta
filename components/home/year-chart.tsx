"use client";

import Link from "next/link";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { searchHref } from "@/lib/listing";
import { LEVELS, plural } from "@/lib/vocab";
import { DataTable, Panel, useTableToggle } from "./section";

const config: ChartConfig = Object.fromEntries(LEVELS.map((l) => [l.key, { label: l.label, color: l.color }]));

type Row = { year: number; federal: number; estadual: number; municipal: number };
type SegmentProps = { x: number; y: number; width: number; height: number; fill: string; payload: Row; level: number };

/** One stacked segment: 2px surface gap below it, rounded only when it is the top of its column. */
function Segment({ x, y, width, height, fill, payload, level }: SegmentProps) {
  if (!height || height <= 0) return null;
  const gap = level > 0 && LEVELS.slice(0, level).some((l) => payload[l.key] > 0) ? 2 : 0;
  const top = !LEVELS.slice(level + 1).some((l) => payload[l.key] > 0);
  const h = height - gap;
  const r = top ? Math.min(6, width / 2, h) : 0;
  return <path d={`M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + h}Z`} fill={fill} />;
}

/** Laws per year, stacked by level. Every year since 1988 is a slot, so empty years read as gaps. */
export function YearChart({ rows, active, onPick }: { rows: Row[]; active: number | null; onPick: (y: number) => void }) {
  const { table, button } = useTableToggle();
  const total = (r: Row) => r.federal + r.estadual + r.municipal;
  return (
    <Panel>
      {table ? (
        <DataTable
          caption="Leis por ano. Cada ano abre a lista das leis dele."
          head={["Ano", "Leis"]}
          rows={rows.filter((r) => total(r)).map((r) => [<Link key={r.year} href={searchHref({ year: r.year })} className="text-primary font-bold underline underline-offset-2">{r.year}</Link>, total(r)])}
        />
      ) : (
        <>
          <ChartContainer config={config} className="aspect-auto h-52 w-full">
            <BarChart data={rows} margin={{ top: 18, right: 4, left: 4, bottom: 0 }} barCategoryGap="12%">
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} interval="preserveStartEnd" ticks={rows.filter((r) => r.year % 5 === 0).map((r) => r.year)} />
              <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(2, max)]} />
              <ChartTooltip cursor={{ fill: "var(--muted)", radius: 6 }} content={<ChartTooltipContent labelFormatter={(l, p) => `${l} · ${plural(p.reduce((s, i) => s + Number(i.value), 0))}`} />} />
              {LEVELS.map((l, i) => (
                <Bar
                  key={l.key}
                  dataKey={l.key}
                  stackId="a"
                  fill={l.color}
                  maxBarSize={24}
                  shape={(props: unknown) => <Segment {...(props as SegmentProps)} level={i} />}
                  animationDuration={600}
                  onClick={(d: { payload?: Row }) => d.payload && onPick(d.payload.year)}
                  className="cursor-pointer"
                >
                  {rows.map((r) => (
                    <Cell key={r.year} opacity={active == null || active === r.year ? 1 : 0.25} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ChartContainer>
          <div className="text-muted-foreground flex flex-wrap gap-4 pt-2 text-xs">
            {LEVELS.map((l) => (
              <span key={l.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </>
      )}
      {button}
    </Panel>
  );
}
