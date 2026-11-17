"use client";

import { ChevronDownIcon } from "lucide-react";
import type { YearRow } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { fmt, STATE_NAMES } from "@/lib/vocab";

const STATES = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
const yearTotal = (r: YearRow) => r.federal + r.estadual + r.municipal;

function Select({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const on = value !== "";
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "focus-visible:ring-ring/40 h-9 appearance-none rounded-full border py-1 pr-8 pl-3.5 text-sm font-semibold outline-none focus-visible:ring-4",
            on ? "border-foreground bg-foreground text-background" : "bg-card",
          )}
        >
          {children}
        </select>
        <ChevronDownIcon className={cn("pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 opacity-70", on && "text-background")} aria-hidden />
      </div>
    </div>
  );
}

/**
 * Year and state pickers on the search page. Years list only those with laws for the other filters picked
 * (plus the one picked, if any), newest first, with their count. States are all 27, by name.
 */
export function FilterSelects({
  years,
  year,
  uf,
  onYear,
  onUf,
}: {
  years: YearRow[];
  year: number | null;
  uf: string;
  onYear: (y: number | null) => void;
  onUf: (uf: string) => void;
}) {
  const options = years.filter((r) => yearTotal(r) > 0 || r.year === year).reverse();
  if (year != null && !options.some((r) => r.year === year)) options.unshift({ year, federal: 0, estadual: 0, municipal: 0 });
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Ano e estado">
      <Select id="filtro-ano" label="Ano" value={year == null ? "" : String(year)} onChange={(v) => onYear(v ? Number(v) : null)}>
        <option value="">Todos os anos</option>
        {options.map((r) => (
          <option key={r.year} value={r.year}>
            {r.year} ({fmt.format(yearTotal(r))})
          </option>
        ))}
      </Select>
      <Select id="filtro-uf" label="Estado" value={uf} onChange={onUf}>
        <option value="">Todos os estados</option>
        {STATES.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </Select>
    </div>
  );
}
