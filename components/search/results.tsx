"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { EMPTY_FILTERS, isFiltered, type Filters, type Overview } from "@/lib/catalog";
import { SEARCH_PATH, writeUrlState } from "@/lib/listing";
import type { Policy } from "@/lib/types";
import { cn } from "@/lib/utils";
import { area, LEVELS, plural } from "@/lib/vocab";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Pager } from "@/components/home/pager";
import { PolicyCard } from "@/components/home/policy-card";
import { PolicySheet } from "@/components/home/policy-sheet";
import { LevelPills, TopicChips } from "@/components/home/topics";
import { useListing } from "@/components/home/use-listing";
import { FilterSelects } from "./filter-selects";

/** Filters picked on a home chart (party) that have no control of their own here: shown as removable chips. */
const CHIPS: { key: "author" | "executive"; label: (v: string) => string }[] = [
  { key: "author", label: (v) => `Proposta por: ${v}` },
  { key: "executive", label: (v) => `Sancionada por: ${v}` },
];

/** Title for what is being shown, e.g. "Leis sobre Saúde" or "Resultados para “escola”". */
export function resultsTitle(f: Filters): string {
  const q = f.q.trim();
  if (q) return `Resultados para “${q}”`;
  if (f.area) return `Leis sobre ${area(f.area).label}`;
  return isFiltered(f) ? "Leis encontradas" : "Todas as leis";
}

/**
 * The search page: the search box, filters, and the list of laws. Filters and page live in the
 * address bar (?q=, ?tema=, ?pagina=...), so the home and any shared link land on the same results.
 */
export function Results({
  firstPage,
  overview: initial,
  pages,
  lastYear,
}: {
  firstPage: Policy[];
  overview: Overview;
  pages: number;
  lastYear: number;
}) {
  const list = useListing({ firstPage, overview: initial, pages, lastYear });
  const f = list.filters;
  const [open, setOpen] = useState<Policy | null>(null);
  // While the filter index loads, keep the last numbers on screen, dimmed.
  const ov = list.overview ?? initial;
  const busy = list.filtered && !list.overview;
  // Clicking the active value again clears it.
  const toggle = <K extends keyof Filters>(k: K, v: Filters[K]) => list.setFilters((s) => ({ ...s, [k]: s[k] === v ? EMPTY_FILTERS[k] : v }));
  const top = () => document.getElementById("resultados")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const chips = CHIPS.filter((c) => f[c.key] != null && f[c.key] !== "");

  return (
    <div className="mx-auto max-w-[1120px] px-[max(16px,env(safe-area-inset-left))] pb-7">
      <SiteNav />

      <main id="conteudo" tabIndex={-1} className="outline-none">
      <header className="grid gap-4 pt-4 pb-2">
        <h1 className="text-[clamp(28px,5vw,44px)] leading-tight font-extrabold tracking-[-0.03em]">{resultsTitle(f)}</h1>
        <form
          role="search"
          className="bg-card border-foreground focus-within:ring-ring/40 flex max-w-[640px] items-center gap-2.5 rounded-[18px] border-2 py-1.5 pr-1.5 pl-4 shadow-[4px_4px_0_var(--foreground)] focus-within:ring-4"
          onSubmit={(e) => {
            e.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur();
            top();
          }}
        >
          <SearchIcon className="text-muted-foreground size-5.5 shrink-0" aria-hidden />
          <input
            type="search"
            value={f.q}
            onChange={(e) => list.setFilters((s) => ({ ...s, q: e.target.value }))}
            placeholder="escola, internet, saúde, idosos…"
            aria-label="Buscar leis"
            className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none"
          />
        </form>
      </header>

      <div className={cn("mt-4 grid gap-3 transition-opacity", busy && "pointer-events-none opacity-50")} aria-busy={busy}>
        <TopicChips keys={initial.topics.map((t) => t.key)} counts={new Map(ov.topics.map((c) => [c.key, c.value]))} active={f.area} onPick={(k) => toggle("area", k)} />
        <LevelPills counts={new Map(ov.levels.map((c) => [c.key, c.value]))} active={f.level} onPick={(k) => toggle("level", k)} />
        <FilterSelects
          years={ov.years}
          year={f.year}
          uf={f.uf}
          onYear={(year) => list.setFilters((s) => ({ ...s, year }))}
          onUf={(uf) => list.setFilters((s) => ({ ...s, uf }))}
        />
        {(chips.length > 0 || list.filtered) && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => list.setFilters((s) => ({ ...s, [c.key]: EMPTY_FILTERS[c.key] }))}
                aria-label={`Tirar filtro ${c.label(String(f[c.key]))}`}
                className="bg-accent inline-flex items-center gap-1.5 rounded-full py-1 pr-2 pl-3 text-sm font-semibold"
              >
                {c.label(String(f[c.key]))}
                <XIcon className="size-3.5" aria-hidden />
              </button>
            ))}
            {list.filtered && (
              <button onClick={() => list.setFilters(EMPTY_FILTERS)} className="bg-foreground text-background rounded-full px-3.5 py-1 text-[13px] font-bold">
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <section id="resultados" aria-labelledby="resultados-n" className="scroll-mt-4 pt-6">
        {/* The count is the list's heading (h2), so each law card's h3 sits under it. */}
        <h2 id="resultados-n" className="text-muted-foreground mb-3 font-sans text-sm font-semibold" aria-live="polite">
          {busy ? "Buscando…" : `${plural(ov.total)}, das mais novas para as mais antigas`}
          {f.level && !busy ? ` · ${LEVELS.find((l) => l.key === f.level)?.label}` : ""}
        </h2>
        <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5 transition-opacity", list.loading && "opacity-50")} aria-busy={list.loading}>
          {list.failed ? (
            <p className="text-muted-foreground col-span-full py-8 text-center">Não deu para carregar esta página. Confira a conexão e tente de novo.</p>
          ) : ov.total || busy ? (
            list.cards.map((p, i) => <PolicyCard key={p.id} p={p} index={i} onOpen={() => setOpen(p)} />)
          ) : (
            <p className="text-muted-foreground col-span-full py-8 text-center">Nenhuma lei com esses filtros. Tente outra palavra ou limpe os filtros.</p>
          )}
        </div>
        {!busy && (
          <Pager
            page={list.page}
            pages={list.pages}
            href={(n) => `${SEARCH_PATH}${writeUrlState(f, n)}`}
            onGo={(n) => {
              list.goTo(n);
              top();
            }}
          />
        )}
      </section>
      </main>

      <SiteFooter />

      <PolicySheet policy={open} onClose={() => setOpen(null)} />
    </div>
  );
}
