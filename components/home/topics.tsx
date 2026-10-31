"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { area, emojiSrc, LEVELS } from "@/lib/vocab";
import type { Level } from "@/lib/types";

const MotionLink = motion.create(Link);

/** Big topic tiles on the home. Each is a link to the search page with that topic picked. */
export function TopicGrid({ keys, counts, href }: { keys: string[]; counts: Map<string, number>; href: (k: string) => string }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {keys.map((k, i) => {
        const a = area(k);
        const n = counts.get(k) ?? 0;
        return (
          <MotionLink
            key={k}
            href={href(k)}
            aria-label={`${a.label}: ${n} ${n === 1 ? "lei" : "leis"}`}
            initial={{ y: 14, opacity: 0.001 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.04, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            whileHover={{ y: -2, rotate: -0.6 }}
            className="group relative flex min-h-28 flex-col gap-4 rounded-[18px] p-3.5 text-left"
            style={{ background: `var(--t-${a.tint}-bg)`, color: `var(--t-${a.tint})` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emojiSrc(a.emoji)} alt="" className={`size-11 transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)] group-hover:scale-115 group-hover:-rotate-8 ${n ? "" : "opacity-45 grayscale"}`} />
            <span className="font-display absolute top-3 right-3.5 text-[22px] font-extrabold">{n}</span>
            <span className="text-foreground mt-auto text-[15px] leading-tight font-bold">{a.label}</span>
          </MotionLink>
        );
      })}
    </div>
  );
}

/** Compact topic chips on the search page: toggles, so the active one can be clicked off again. */
export function TopicChips({ keys, counts, active, onPick }: { keys: string[]; counts: Map<string, number>; active: string; onPick: (k: string) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Temas">
      {keys.map((k) => {
        const a = area(k);
        return (
          <button
            key={k}
            onClick={() => onPick(k)}
            aria-pressed={active === k}
            className="bg-card aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:border-foreground inline-flex flex-none items-center gap-1.5 rounded-full border py-1 pr-3 pl-1.5 text-sm font-semibold whitespace-nowrap"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emojiSrc(a.emoji)} alt="" className="size-5.5" />
            {a.label}
            <small className="opacity-70">{counts.get(k) ?? 0}</small>
          </button>
        );
      })}
    </div>
  );
}

export function LevelPills({ counts, active, onPick }: { counts: Map<string, number>; active: string; onPick: (k: Level) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Nível de governo">
      {LEVELS.map((l) => (
        <button
          key={l.key}
          onClick={() => onPick(l.key)}
          aria-pressed={active === l.key}
          className="bg-card aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:border-foreground inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2.5 text-sm font-semibold"
        >
          <i aria-hidden className="size-2.5 rounded-full" style={{ background: l.color }} />
          {l.label}
          <small className="opacity-70">{counts.get(l.key) ?? 0}</small>
        </button>
      ))}
    </div>
  );
}
