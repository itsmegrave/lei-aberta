"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { partyScore, spectrumColor, SPECTRUM_SOURCE, SPECTRUM_STOPS } from "@/lib/party-spectrum";
import { fmt, plural } from "@/lib/vocab";
import { useDark } from "./use-dark";
import { useWidth } from "./use-width";
import { DataTable, Panel, useTableToggle } from "./section";

type Counts = { key: string; value: number }[];
type Key = "author" | "executive";

/**
 * Dot plot on the published 0-10 left-right scale. One line per party so nothing collides at any width.
 * Author party and executive party are two separate groups, never merged.
 */
export function PartyPlot({
  author,
  executive,
  active,
  onPick,
}: {
  author: Counts;
  executive: Counts;
  active: { author: string; executive: string };
  onPick: (k: Key, v: string) => void;
}) {
  const dark = useDark();
  const mode = dark ? "dark" : "light";
  const { table, button } = useTableToggle();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number; title: string; body: string } | null>(null);
  const groups = useMemo(
    () =>
      ([["Propôs", author, "author"], ["Sancionou", executive, "executive"]] as const).map(([title, list, key]) => ({
        title,
        key,
        list: list.filter((p) => partyScore(p.key) != null).sort((a, b) => partyScore(a.key)! - partyScore(b.key)! || a.key.localeCompare(b.key)),
      })),
    [author, executive],
  );
  const unplaced = [
    ...author.filter((p) => partyScore(p.key) == null).map((p) => ({ ...p, k: "author" as Key, verb: "propôs" })),
    ...executive.filter((p) => partyScore(p.key) == null).map((p) => ({ ...p, k: "executive" as Key, verb: "sancionou" })),
  ];

  const m = { l: 14, r: 14 }, line = 30, head = 30, gapG = 16;
  const H = groups.reduce((h, g) => h + head + Math.max(1, g.list.length) * line + gapG, 0) + 18;
  const X = (v: number) => m.l + (v / 10) * (w - m.l - m.r);
  const maxN = Math.max(1, ...author.map((p) => p.value), ...executive.map((p) => p.value));
  const rad = (n: number) => 6 + Math.sqrt(n / maxN) * 8;
  let y0 = 0, idx = 0;

  return (
    <Panel>
      {table ? (
        <DataTable
          head={["Partido", "Posição (0–10)", "Leis propostas", "Leis sancionadas"]}
          rows={[...new Set([...author, ...executive].map((p) => p.key))]
            .sort((a, b) => (partyScore(a) ?? 99) - (partyScore(b) ?? 99))
            .map((k) => [k, partyScore(k) == null ? "—" : fmt.format(partyScore(k)!), author.find((p) => p.key === k)?.value ?? 0, executive.find((p) => p.key === k)?.value ?? 0])}
        />
      ) : (
        <div className="relative" ref={ref}>
          <svg viewBox={`0 0 ${w} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Partidos na escala esquerda-direita">
            {Array.from({ length: 11 }, (_, v) => (
              <line key={v} x1={X(v)} x2={X(v)} y1={head - 8} y2={H - 18} stroke={v === 5 ? "var(--chart-axis)" : "var(--chart-grid)"} />
            ))}
            {[0, 5, 10].map((v) => (
              <text key={v} x={X(v)} y={H - 4} textAnchor={v === 0 ? "start" : v === 10 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
                {v}
              </text>
            ))}
            {groups.map((g) => {
              const top = y0;
              y0 += head + Math.max(1, g.list.length) * line + gapG;
              return (
                <g key={g.key}>
                  <text x={m.l} y={top + 16} className="font-display fill-muted-foreground text-xs font-bold">
                    {g.title}
                  </text>
                  {!g.list.length && (
                    <text x={m.l} y={top + head + 14} className="fill-muted-foreground text-[11px]">
                      Nenhum partido classificado com estes filtros
                    </text>
                  )}
                  {g.list.map((p, i) => {
                    const s = partyScore(p.key)!, x = X(s), y = top + head + i * line + line / 2, r = rad(p.value);
                    const color = spectrumColor(s, mode);
                    const lw = (p.key.length + 4) * 7.5;
                    let right = s >= 5;
                    if (right && x + r + 6 + lw > w) right = false;
                    if (!right && x - r - 6 - lw < 0) right = true;
                    const dim = active[g.key] && active[g.key] !== p.key;
                    const show = (e: React.PointerEvent | React.FocusEvent) => {
                      const box = (e.currentTarget as SVGGElement).ownerSVGElement!.getBoundingClientRect();
                      setTip({ x: (x / w) * box.width, y: (y / H) * box.height, title: plural(p.value), body: `${p.key} · ${g.title.toLowerCase()} · posição ${fmt.format(s)} de 10` });
                    };
                    return (
                      <g
                        key={p.key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${p.key}, ${g.title.toLowerCase()}: ${plural(p.value)}`}
                        className="cursor-pointer outline-none"
                        opacity={dim ? 0.25 : 1}
                        onClick={() => onPick(g.key, p.key)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(g.key, p.key))}
                        onPointerMove={show}
                        onFocus={show}
                        onPointerLeave={() => setTip(null)}
                        onBlur={() => setTip(null)}
                      >
                        <rect x={0} y={y - line / 2} width={w} height={line} fill="transparent" />
                        <line x1={X(5)} x2={x} y1={y} y2={y} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.35} />
                        <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: idx++ * 0.06, type: "spring", stiffness: 380, damping: 18 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                          <circle cx={x} cy={y} r={r + 2} fill="var(--card)" />
                          <circle cx={x} cy={y} r={r} fill={color} />
                        </motion.g>
                        <text x={right ? x + r + 6 : x - r - 6} y={y + 4} textAnchor={right ? "start" : "end"} className="fill-foreground text-xs font-bold">
                          {p.key} · {p.value}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
          {tip && (
            <div className="bg-foreground text-background pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl px-3 py-2 text-xs shadow-xl" style={{ left: tip.x, top: tip.y }}>
              <div className="font-display text-sm font-bold">{tip.title}</div>
              {tip.body}
            </div>
          )}
        </div>
      )}
      <div className="text-muted-foreground mt-1.5 grid grid-cols-[auto_1fr_auto] items-center gap-2.5 text-[13px] font-bold">
        <span>Esquerda</span>
        <div className="h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${SPECTRUM_STOPS[mode].left}, ${SPECTRUM_STOPS[mode].mid}, ${SPECTRUM_STOPS[mode].right})` }} />
        <span>Direita</span>
      </div>
      {unplaced.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {unplaced.map((p) => (
            <button
              key={p.k + p.key}
              onClick={() => onPick(p.k, p.key)}
              aria-pressed={active[p.k] === p.key}
              className="text-muted-foreground aria-pressed:border-foreground rounded-full border border-dashed px-2.5 py-0.5 text-[13px] aria-pressed:border-solid"
            >
              <b className="text-foreground">{p.key}</b> {p.verb} {p.value}
            </button>
          ))}
        </div>
      )}
      <p className="text-muted-foreground mt-2.5 mb-0 text-xs">
        Posição dos partidos: média de especialistas em{" "}
        <a className="text-primary underline" href={SPECTRUM_SOURCE.url} target="_blank" rel="noopener noreferrer">
          {SPECTRUM_SOURCE.label}
        </a>
        . Nomes antigos usam a nota do mesmo partido renomeado (PMDB→MDB, PFL→DEM, PRN→PTC). Não fazemos avaliação própria.
      </p>
      {button}
    </Panel>
  );
}
