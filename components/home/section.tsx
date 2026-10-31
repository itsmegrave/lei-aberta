"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DESKTOP = "(min-width: 768px)";
const subscribeDesktop = (cb: () => void) => {
  const m = window.matchMedia(DESKTOP);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * A home section. With `collapsible`, phones get an accordion (closed by default) to cut scrolling;
 * from the md breakpoint up the section is always open and looks like a plain heading.
 * `note` shows next to the heading while closed, e.g. the filter picked inside it.
 */
export function Section({
  id,
  title,
  lead,
  action,
  collapsible,
  note,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  action?: React.ReactNode;
  collapsible?: boolean;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Clip only while moving or closed, so shadows and tooltips are not cut once open.
  const [settled, setSettled] = useState(false);
  const toggle = () => {
    setSettled(false);
    setOpen((o) => !o);
  };
  // Server snapshot is "phone": the static HTML ships closed sections, desktop CSS shows them anyway.
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
  const bodyId = `${id}-body`;

  // Links to the section (e.g. the "Fontes" nav link) open it.
  useEffect(() => {
    if (!collapsible) return;
    const sync = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [collapsible, id]);

  const heading = (
    <h2 id={id} className="scroll-mt-4 text-[clamp(24px,3.6vw,34px)] leading-[1.05] font-extrabold tracking-[-0.025em]">
      {collapsible ? (
        <button
          type="button"
          onClick={() => !desktop && toggle()}
          aria-expanded={desktop || open}
          aria-controls={bodyId}
          className="flex w-full items-center gap-2.5 text-left md:cursor-text"
        >
          {title}
          {note && !open && <span className="bg-foreground text-background rounded-full px-2.5 py-0.5 text-[13px] font-bold tracking-normal md:hidden">{note}</span>}
          <span className="bg-secondary ml-auto grid size-9 shrink-0 place-items-center rounded-full md:hidden" aria-hidden>
            <ChevronDownIcon className={cn("size-5 transition-transform duration-300 motion-reduce:transition-none", open && "rotate-180")} />
          </span>
        </button>
      ) : (
        title
      )}
    </h2>
  );

  if (!collapsible)
    return (
      <section aria-labelledby={id} className="mt-12">
        <div className="mb-3.5 flex flex-wrap items-end gap-3">
          {heading}
          {action}
          {lead && <p className="text-muted-foreground m-0 basis-full">{lead}</p>}
        </div>
        {children}
      </section>
    );

  // Height animates through grid rows (0fr -> 1fr); md: forces the open state.
  return (
    <section aria-labelledby={id} className="mt-6 border-b pb-4 md:mt-12 md:border-b-0 md:pb-0">
      <div className="flex flex-wrap items-end gap-3 md:mb-3.5">
        <div className="min-w-0 flex-1 md:flex-none">{heading}</div>
        {action}
      </div>
      <div
        id={bodyId}
        role="region"
        aria-labelledby={id}
        inert={!desktop && !open}
        onTransitionEnd={(e) => e.target === e.currentTarget && setSettled(open)}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none md:grid-rows-[1fr] md:opacity-100",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className={cn("min-h-0 overflow-hidden md:overflow-visible", open && settled && "overflow-visible")}>
          {lead && <p className="text-muted-foreground mt-2 mb-3.5 md:mt-0">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("bg-card min-w-0 rounded-[22px] p-4.5 shadow-[0_1px_0_rgba(23,20,46,0.04),0_10px_30px_-12px_rgba(23,20,46,0.18)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]", className)} {...props} />;
}

/** Every chart has a table view: the path to each value that needs no hover. */
export function useTableToggle() {
  const [table, setTable] = useState(false);
  const button = (
    <button onClick={() => setTable((t) => !t)} className="text-primary mt-2 text-[13px] font-bold">
      {table ? "Ver como gráfico" : "Ver como tabela"}
    </button>
  );
  return { table, button };
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>{head.map((h) => <th key={h} className="border-b p-1.5 text-left">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cn("border-b p-1.5", typeof c === "number" && "text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
