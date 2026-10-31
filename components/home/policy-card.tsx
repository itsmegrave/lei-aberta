"use client";

import { ArrowRightIcon } from "lucide-react";
import { motion } from "motion/react";
import { lawPath } from "@/lib/share";
import type { Policy } from "@/lib/types";
import { area, emojiSrc, lawLabel, LEVELS } from "@/lib/vocab";

export { lawLabel } from "@/lib/vocab";

export function PolicyCard({ p, index, onOpen }: { p: Policy; index: number; onOpen: () => void }) {
  const a = area(p.areas[0]);
  const lvl = LEVELS.find((l) => l.key === p.level)!;
  return (
    // A real link to the law's page (crawlable, opens in a new tab with Ctrl/Cmd-click); a plain click opens the sheet.
    <motion.a
      href={lawPath(p.id)}
      layout
      initial={{ y: 14, opacity: 0.001 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: Math.min(index, 12) * 0.04, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={{ y: -3 }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onOpen();
      }}
      className="bg-card flex min-w-0 flex-col overflow-hidden rounded-[22px] text-left shadow-[0_1px_0_rgba(23,20,46,0.04),0_10px_30px_-12px_rgba(23,20,46,0.18)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
    >
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3" style={{ background: `var(--t-${a.tint}-bg)`, color: `var(--t-${a.tint})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={emojiSrc(a.emoji)} alt="" className="size-8.5" />
        <span className="text-[13px] font-bold">{a.label}</span>
        <span className="font-display ml-auto text-[26px] leading-none font-extrabold tracking-[-0.02em]">{p.year}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-3.5 pb-4">
        <h3 className="text-[19px] leading-[1.15] font-bold tracking-[-0.015em]">{p.title}</h3>
        <p className="text-muted-foreground m-0 line-clamp-2 text-[14.5px]">{p.summary}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2 text-[12.5px]">
          <span className="bg-secondary text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold">
            <span className="size-2 rounded-full" style={{ background: lvl.color }} />
            {lvl.label}
          </span>
          <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 font-semibold">{lawLabel(p)}</span>
        </div>
        <span className="text-primary flex items-center gap-1 text-[13px] font-bold">
          Ver detalhes e fonte <ArrowRightIcon className="size-3.5" />
        </span>
      </div>
    </motion.a>
  );
}
