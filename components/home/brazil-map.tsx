"use client";

import { motion } from "motion/react";
import { useState } from "react";
import MAP from "@/lib/br-map.json";
import { plural } from "@/lib/vocab";
import { DataTable, Panel, useTableToggle } from "./section";

const names = MAP.names as Record<string, string>;
const paths = MAP.paths as Record<string, string>;
const centers = MAP.c as Record<string, number[]>;

/** Brazil by state of the proposing lawmaker. Sequential single hue, light to dark. */
export function BrazilMap({ counts, active, onPick }: { counts: Map<string, number>; active: string; onPick: (uf: string) => void }) {
  const { table, button } = useTableToggle();
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...counts.values());
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const focus = hover ?? (active || null);
  const shown = focus ? counts.get(focus) ?? 0 : total;
  // color-mix keeps the ramp in CSS tokens, so it follows the theme.
  const fill = (n: number) => (n ? `color-mix(in oklab, var(--ramp-hi) ${max === 1 ? 100 : Math.round(((n - 1) / (max - 1)) * 100)}%, var(--ramp-lo))` : "var(--secondary)");

  return (
    <Panel className="grid items-center gap-5 md:grid-cols-[1.2fr_1fr]">
      <div className="min-w-0">
        {table ? (
          <DataTable head={["Estado", "Leis propostas"]} rows={Object.keys(names).sort().map((u) => [names[u], counts.get(u) ?? 0])} />
        ) : (
          <svg viewBox={`-4 -4 ${MAP.w + 8} ${MAP.h + 8}`} className="block h-auto w-full" role="img" aria-label="Mapa do Brasil por estado de quem propôs">
            {Object.entries(paths).map(([uf, d], i) => {
              const n = counts.get(uf) ?? 0;
              return (
                <motion.path
                  key={uf}
                  d={d}
                  initial={{ opacity: 0.001 }}
                  animate={{ opacity: active && active !== uf ? 0.3 : 1 }}
                  transition={{ delay: i * 0.02, duration: 0.4 }}
                  fill={fill(n)}
                  stroke={active === uf ? "var(--foreground)" : "var(--card)"}
                  strokeWidth={active === uf ? 2.5 : 1.2}
                  strokeLinejoin="round"
                  role="button"
                  tabIndex={0}
                  aria-label={`${names[uf]}: ${plural(n)}`}
                  className="cursor-pointer outline-none transition-[fill]"
                  onClick={() => onPick(uf)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(uf))}
                  onPointerEnter={() => setHover(uf)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(uf)}
                  onBlur={() => setHover(null)}
                />
              );
            })}
            {[...counts.keys()].map((uf) =>
              centers[uf] ? (
                <text key={uf} x={centers[uf][0]} y={centers[uf][1] + 4} textAnchor="middle" className="fill-foreground pointer-events-none text-[11px] font-extrabold">
                  {uf}
                </text>
              ) : null,
            )}
          </svg>
        )}
      </div>
      <div>
        <div className="font-display text-[44px] leading-none font-extrabold tracking-[-0.03em]">{shown}</div>
        <div className="text-muted-foreground">
          {shown === 1 ? "lei proposta" : "leis propostas"} por parlamentares {focus ? <>de <b className="text-foreground">{names[focus]}</b></> : `de ${counts.size} estados`}
        </div>
        <div className="text-muted-foreground mt-3.5 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
          <span>1</span>
          <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,var(--ramp-lo),var(--ramp-hi))]" />
          <span>{max}</span>
        </div>
        <p className="text-muted-foreground mt-2.5 mb-0 text-xs">
          Contorno dos estados:{" "}
          <a className="text-primary underline" href="https://github.com/giuliano-oliveira/geodata-br-states" target="_blank" rel="noopener noreferrer">
            geodata-br-states
          </a>{" "}
          (MIT), feito com dados do IBGE via LAGEAMB/UFPR. Projetos do Poder Executivo não têm estado e ficam fora do mapa.
        </p>
        {button}
      </div>
    </Panel>
  );
}
