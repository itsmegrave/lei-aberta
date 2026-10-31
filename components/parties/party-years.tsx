"use client";

import { DataTable, Panel, useTableToggle } from "@/components/home/section";
import { plural } from "@/lib/vocab";

type Year = { year: number; proposed: number; signed: number };

/** Two strips of yearly bars: laws the party proposed, and laws signed by its president, governor or mayor. */
export function PartyYears({ years }: { years: Year[] }) {
  const { table, button } = useTableToggle();
  const rows = [
    { key: "proposed" as const, label: "Propôs", cls: "bg-primary" },
    { key: "signed" as const, label: "Sancionou", cls: "bg-foreground/70" },
  ];
  const first = years[0]?.year, last = years[years.length - 1]?.year;
  return (
    <Panel>
      {table ? (
        <DataTable head={["Ano", "Leis propostas", "Leis sancionadas"]} rows={years.filter((y) => y.proposed || y.signed).map((y) => [String(y.year), y.proposed, y.signed])} />
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => {
            // Each strip has its own scale: they count different things.
            const max = Math.max(1, ...years.map((y) => y[r.key]));
            return (
            <div key={r.key}>
              <div className="font-display text-muted-foreground mb-1.5 flex justify-between text-xs font-bold"><span>{r.label}</span><span>máx. {max} por ano</span></div>
              <div className="flex h-20 items-end gap-px border-b border-[var(--chart-axis)]">
                {years.map((y) => (
                  <div key={y.year} className="group relative flex h-full flex-1 items-end" title={`${y.year}: ${plural(y[r.key])}`}>
                    <div className={`${r.cls} w-full rounded-t-[2px]`} style={{ height: y[r.key] ? `${Math.max(4, (y[r.key] / max) * 100)}%` : 0 }} />
                  </div>
                ))}
              </div>
            </div>
            );
          })}
          <div className="text-muted-foreground -mt-2.5 flex justify-between text-[11px]">
            <span>{first}</span>
            <span>{last}</span>
          </div>
        </div>
      )}
      {button}
    </Panel>
  );
}
