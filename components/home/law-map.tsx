import MAP from "@/lib/br-map.json";
import { lawPlace } from "@/lib/law-place";
import type { Policy } from "@/lib/types";

const names = MAP.names as Record<string, string>;
const paths = MAP.paths as Record<string, string>;
const centers = MAP.c as Record<string, number[]>;

const Swatch = ({ color }: { color: string }) => <i className="inline-block size-2.5 shrink-0 rounded-full border border-current/20" style={{ background: color }} />;

/**
 * Small Brazil map for one law: where it applies (the whole country, or one state) and, for federal laws,
 * the states of the lawmakers who proposed it. The sentence beside it says the same, so the drawing is decorative.
 */
export function LawMap({ p }: { p: Policy }) {
  const place = lawPlace(p, names);
  const strong = new Set(place.scope === "country" ? place.authorUfs : place.uf ? [place.uf] : []);
  const fill = (uf: string) => (strong.has(uf) ? "var(--ramp-hi)" : place.scope === "country" ? "var(--ramp-lo)" : "var(--secondary)");
  const authorStates = place.authorUfs.map((u) => names[u]);

  return (
    <figure className="bg-card m-0 flex items-center gap-4 rounded-2xl border px-3.5 py-3" data-testid="law-map">
      <svg viewBox={`-4 -4 ${MAP.w + 8} ${MAP.h + 8}`} className="block h-auto w-[116px] shrink-0 sm:w-[136px]" aria-hidden focusable="false">
        {Object.entries(paths).map(([uf, d]) => (
          <path key={uf} d={d} fill={fill(uf)} stroke="var(--card)" strokeWidth={6} strokeLinejoin="round" data-uf={uf} data-strong={strong.has(uf) || undefined} />
        ))}
        {[...strong].map((uf) =>
          centers[uf] ? (
            <text key={uf} x={centers[uf][0]} y={centers[uf][1] + 16} textAnchor="middle" className="map-label fill-foreground text-[48px] font-extrabold">
              {uf}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="min-w-0">
        <div className="text-muted-foreground text-xs font-bold tracking-[0.06em] uppercase">Onde vale</div>
        <div className="mt-0.5 text-base leading-snug font-bold">{place.text}</div>
        {authorStates.length > 0 && (
          <div className="text-muted-foreground mt-1.5 grid gap-1 text-[13px]">
            <span className="flex items-center gap-1.5">
              <Swatch color="var(--ramp-hi)" />
              {authorStates.length === 1 ? "Estado de quem propôs" : "Estados de quem propôs"}: {authorStates.join(", ")}
            </span>
          </div>
        )}
      </figcaption>
    </figure>
  );
}
