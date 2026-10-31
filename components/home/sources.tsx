"use client";

import { CheckIcon, ClockIcon, ExternalLinkIcon, HammerIcon, TriangleAlertIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { STATUS_LABEL, timeAgo, type DataSource, type SourceStatus } from "@/lib/sources";
import { emojiSrc, fmt, LEVELS } from "@/lib/vocab";
import { Panel } from "./section";

// Status reads by icon + label, never color alone.
const STATUS_STYLE: Record<SourceStatus, { icon: React.ComponentType<{ className?: string }>; dot: string }> = {
  active: { icon: CheckIcon, dot: "#0ca30c" },
  building: { icon: HammerIcon, dot: "var(--primary)" },
  planned: { icon: ClockIcon, dot: "var(--muted-foreground)" },
  failing: { icon: TriangleAlertIcon, dot: "#d03b3b" },
};

const EMOJI: Record<string, string> = { "querido-diario": "scroll", dou: "scroll", "amostra-inicial": "books" };

export function Sources({ sources }: { sources: DataSource[] }) {
  // Relative times depend on "now": render them after mount so the static HTML never goes stale.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const by = (s: SourceStatus) => sources.filter((x) => x.status === s).length;
  const summary = (["active", "building", "planned", "failing"] as const)
    .filter((s) => by(s))
    .map((s) => `${by(s)} ${s === "planned" && by(s) > 1 ? "planejadas" : STATUS_LABEL[s].toLowerCase()}`)
    .join(" · ");

  return (
    <>
      <p className="text-muted-foreground -mt-1 mb-3.5 text-sm font-semibold">{summary}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
        {sources.map((s, i) => {
          const st = STATUS_STYLE[s.status];
          const Icon = st.icon;
          return (
            <motion.div key={s.id} initial={{ y: 14, opacity: 0.001 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.45 }}>
              <Panel className="flex h-full flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={emojiSrc(EMOJI[s.id] ?? "classical-building")} alt="" className="size-9" />
                  <span className="bg-secondary inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold">
                    <Icon className="size-3.5" aria-hidden />
                    <span aria-hidden className="size-1.5 rounded-full" style={{ background: st.dot }} />
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                <div>
                  <div className="font-display text-[17px] leading-tight font-bold">{s.name}</div>
                  <div className="text-muted-foreground text-xs">{s.publisher}</div>
                </div>
                <p className="text-muted-foreground m-0 text-sm">{s.description}</p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {s.levels.map((l) => {
                    const lv = LEVELS.find((x) => x.key === l)!;
                    return (
                      <span key={l} className="bg-secondary inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold">
                        <span className="size-2 rounded-full" style={{ background: lv.color }} />
                        {lv.label}
                      </span>
                    );
                  })}
                  {s.covers.map((c) => (
                    <span key={c} className="bg-secondary rounded-full px-2 py-0.5 font-semibold">
                      {c}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-end gap-3 border-t pt-2.5 text-xs">
                  <div>
                    <div className="font-display text-xl leading-none font-extrabold">{s.records != null ? fmt.format(s.records) : "—"}</div>
                    <div className="text-muted-foreground">registros</div>
                  </div>
                  <div className="text-muted-foreground">
                    {s.lastSuccess ? <>Atualizada {now ? timeAgo(s.lastSuccess, now) : new Date(s.lastSuccess).toLocaleDateString("pt-BR")}</> : "Ainda sem coleta"}
                    {s.since ? <div>Desde {s.since} · {s.coverage.join(", ")}</div> : <div>{s.coverage.join(", ")}</div>}
                  </div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary ml-auto inline-flex items-center gap-1 py-1 font-bold hover:underline">
                    Site{" "}<span className="sr-only">de {s.name} (abre em nova aba)</span> <ExternalLinkIcon className="size-3.5" aria-hidden />
                  </a>
                </div>
              </Panel>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
