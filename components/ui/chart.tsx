"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

// shadcn/ui chart wrapper around Recharts: config maps series keys to labels and colors.
export type ChartConfig = {
  [k in string]: { label?: React.ReactNode; icon?: React.ComponentType; color?: string };
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within a <ChartContainer />");
  return ctx;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uid = React.useId();
  const chartId = `chart-${id || uid.replace(/:/g, "")}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-[var(--chart-grid)] [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, c]) => c.color);
  if (!entries.length) return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${entries.map(([k, c]) => `  --color-${k}: ${c.color};`).join("\n")}\n}`,
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipItem = { dataKey?: string | number; name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown> };

function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  hideZero = true,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: React.ReactNode;
  labelFormatter?: (label: React.ReactNode, payload: TooltipItem[]) => React.ReactNode;
  hideZero?: boolean;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => !hideZero || Number(p.value) !== 0);
  return (
    <div className="bg-foreground text-background grid min-w-36 gap-1 rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="font-display text-sm font-bold">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      {items.map((item) => {
        const key = String(item.dataKey ?? item.name ?? "value");
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: config[key]?.color ?? item.color }} />
            <span className="opacity-80">{config[key]?.label ?? item.name}</span>
            <span className="ml-auto font-semibold tabular-nums">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartLegendContent({ keys }: { keys?: string[] }) {
  const { config } = useChart();
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-4 pt-3 text-xs">
      {(keys ?? Object.keys(config)).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: config[k]?.color }} />
          {config[k]?.label}
        </span>
      ))}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegendContent, ChartStyle };
