"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Section({ id, title, lead, action, children }: { id: string; title: string; lead?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <h2 id={id} className="text-[clamp(24px,3.6vw,34px)] leading-[1.05] font-extrabold tracking-[-0.025em]">
          {title}
        </h2>
        {action}
        {lead && <p className="text-muted-foreground m-0 basis-full">{lead}</p>}
      </div>
      {children}
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
