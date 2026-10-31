"use client";

import { motion } from "motion/react";
import { area, emojiSrc, LEVELS } from "@/lib/vocab";
import { cn } from "@/lib/utils";
import type { Level } from "@/lib/types";

export function TopicGrid({ keys, counts, active, onPick }: { keys: string[]; counts: Map<string, number>; active: string; onPick: (k: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {keys.map((k, i) => {
        const a = area(k);
        const n = counts.get(k) ?? 0;
        return (
          <motion.button
            key={k}
            initial={{ y: 14, opacity: 0.001 }}
            animate={{ y: 0, opacity: n ? 1 : 0.45 }}
            transition={{ delay: i * 0.04, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            whileHover={{ y: -2, rotate: -0.6 }}
            onClick={() => onPick(k)}
            aria-pressed={active === k}
            className={cn("group relative flex min-h-28 flex-col gap-4 rounded-[18px] p-3.5 text-left", active === k && "ring-foreground ring-3")}
            style={{ background: `var(--t-${a.tint}-bg)`, color: `var(--t-${a.tint})` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emojiSrc(a.emoji)} alt="" className="size-11 transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)] group-hover:scale-115 group-hover:-rotate-8" />
            <span className="font-display absolute top-3 right-3.5 text-[22px] font-extrabold">{n}</span>
            <span className="text-foreground mt-auto text-[15px] leading-tight font-bold">{a.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function LevelPills({ counts, active, onPick }: { counts: Map<string, number>; active: string; onPick: (k: Level) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Nível de governo">
      {LEVELS.map((l) => (
        <button
          key={l.key}
          onClick={() => onPick(l.key)}
          aria-pressed={active === l.key}
          className="bg-card aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:border-foreground inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2.5 text-sm font-semibold"
        >
          <i className="size-2.5 rounded-full" style={{ background: l.color }} />
          {l.label}
          <small className="opacity-70">{counts.get(l.key) ?? 0}</small>
        </button>
      ))}
    </div>
  );
}
