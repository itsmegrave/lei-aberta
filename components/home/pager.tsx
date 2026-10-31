"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { pageWindow } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/vocab";

/** Numbered pages. Each is a real link (?pagina=n), so it can be opened in a new tab, shared and crawled. */
export function Pager({ page, pages, href, onGo }: { page: number; pages: number; href: (n: number) => string; onGo: (n: number) => void }) {
  if (pages <= 1) return null;
  const go = (n: number) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onGo(n);
  };
  const item = (n: number, children: ReactNode, label: string, current = false, wide = false) => (
    <a
      key={label}
      href={href(n)}
      onClick={go(n)}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(
        "grid h-9 min-w-9 place-items-center rounded-full px-2 text-[13px] sm:h-10 sm:min-w-10 sm:px-3 sm:text-sm font-bold tabular-nums transition-colors",
        current ? "bg-foreground text-background" : "bg-card hover:bg-accent border",
        wide && "hidden sm:grid",
      )}
    >
      {children}
    </a>
  );
  return (
    <nav aria-label="Páginas da lista de leis" className="mt-6 flex flex-col items-center gap-2.5">
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
        {page > 1 && item(page - 1, <ChevronLeftIcon className="size-4" />, "Página anterior")}
        {pageWindow(page, pages).map((n, i) =>
          n == null ? (
            <span key={`gap-${i}`} className="text-muted-foreground px-1" aria-hidden>
              …
            </span>
          ) : (
            // On phones, drop the pages two steps away so the row fits on one line.
            item(n, fmt.format(n), `Página ${n}`, n === page, Math.abs(n - page) === 2 && n !== 1 && n !== pages)
          ),
        )}
        {page < pages && item(page + 1, <ChevronRightIcon className="size-4" />, "Próxima página")}
      </div>
      <span className="text-muted-foreground text-[13px]">
        Página {fmt.format(page)} de {fmt.format(pages)}
      </span>
    </nav>
  );
}
