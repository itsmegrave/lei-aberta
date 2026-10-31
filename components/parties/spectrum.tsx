import { partyScore, spectrumColor, SPECTRUM_STOPS } from "@/lib/party-spectrum";
import { fmt } from "@/lib/vocab";
import { cn } from "@/lib/utils";

/** Both theme colors as CSS variables, so server-rendered pages follow the theme without JavaScript. */
export function spectrumVars(score: number | null): React.CSSProperties {
  return { "--pc": spectrumColor(score, "light"), "--pc-d": spectrumColor(score, "dark") } as React.CSSProperties;
}
const PC = "bg-[var(--pc)] dark:bg-[var(--pc-d)]";

/** Colored dot for a party, by its position on the survey's left-right scale (gray when it has none). */
export function PartyDot({ party, className }: { party: string; className?: string }) {
  return <i aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", PC, className)} style={spectrumVars(partyScore(party))} />;
}

const gradient = (m: "light" | "dark") => `linear-gradient(90deg, ${SPECTRUM_STOPS[m].left}, ${SPECTRUM_STOPS[m].mid}, ${SPECTRUM_STOPS[m].right})`;

/** The 0-10 scale with the party's marker, or a plain note when the survey has no position for it. */
export function PositionBar({ party, compact = false }: { party: string; compact?: boolean }) {
  const s = partyScore(party);
  if (s == null)
    return <p className={cn("text-muted-foreground m-0", compact ? "text-xs" : "text-sm")}>Sem posição na pesquisa de especialistas.</p>;
  return (
    <div className="grid gap-1" role="img" aria-label={`Posição ${fmt.format(s)} numa escala de 0 (esquerda) a 10 (direita)`}>
      <div className="relative h-2.5">
        <div
          className="absolute inset-0 rounded-full bg-[image:var(--g)] opacity-60 dark:bg-[image:var(--g-d)]"
          style={{ "--g": gradient("light"), "--g-d": gradient("dark") } as React.CSSProperties}
        />
        <span
          className={cn("ring-card absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-3", PC)}
          style={{ left: `${s * 10}%`, ...spectrumVars(s) }}
        />
      </div>
      {!compact && (
        <div className="text-muted-foreground flex justify-between text-xs font-bold">
          <span>Esquerda</span>
          <span className="text-foreground">{fmt.format(s)} de 10</span>
          <span>Direita</span>
        </div>
      )}
    </div>
  );
}
