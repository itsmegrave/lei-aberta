"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { fmt } from "@/lib/vocab";
import { Panel } from "./section";

/** Counts up from 0 on change. The final value is rendered first, so the page is complete without motion. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || !ref.current) return;
    const node = ref.current;
    const controls = animate(0, value, { duration: 0.7, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => (node.textContent = fmt.format(Math.round(v))) });
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref}>{fmt.format(value)}</span>;
}

export function Facts({ items }: { items: { value: number; suffix?: string; label: string }[] }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((f, i) => (
        <Panel key={f.label} className={i === 0 ? "col-span-2 sm:col-span-1" : undefined}>
          <div className="font-display text-[clamp(34px,6vw,52px)] leading-none font-extrabold tracking-[-0.03em]">
            <CountUp value={f.value} />
            {f.suffix}
          </div>
          <div className="text-muted-foreground mt-1 text-sm">{f.label}</div>
        </Panel>
      ))}
    </div>
  );
}
