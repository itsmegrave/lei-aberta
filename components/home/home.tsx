"use client";

import { useMemo, useState } from "react";
import { applyFilters, authorKeys, countBy, EMPTY_FILTERS, executiveKey, perAuthorState, perYear, type Filters } from "@/lib/catalog";
import type { Policy } from "@/lib/types";
import type { DataSource } from "@/lib/sources";
import { Sources } from "./sources";
import { area, AREAS, fmt, plural } from "@/lib/vocab";
import { BrazilMap } from "./brazil-map";
import { Facts } from "./facts";
import { Hero, Ticker } from "./hero";
import { PartyPlot } from "./party-plot";
import { PolicyCard } from "./policy-card";
import { PolicySheet } from "./policy-sheet";
import { Section } from "./section";
import { ThemeToggle } from "./theme-toggle";
import { LevelPills, TopicGrid } from "./topics";
import { YearChart } from "./year-chart";

export function Home({ policies, sample, sources }: { policies: Policy[]; updatedAt: string; sample: boolean; sources: DataSource[] }) {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [open, setOpen] = useState<Policy | null>(null);
  // Render cards in pages: the full catalog can reach thousands of laws.
  const PAGE = 24;
  const [shown, setShown] = useState(PAGE);
  // Clicking the active value again clears it.
  const toggle = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((s) => ({ ...s, [k]: s[k] === v ? EMPTY_FILTERS[k] : v }));
    setShown(PAGE);
  };
  const view = (skip?: keyof Filters) => applyFilters(policies, f, skip);

  const rows = useMemo(() => view(), [policies, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastYear = Math.max(new Date().getFullYear(), ...policies.map((p) => p.year));
  const years = rows.map((r) => r.year);
  const topicKeys = Object.keys(AREAS).filter((k) => policies.some((p) => p.areas.includes(k)));
  const active = f.q || f.level || f.area || f.author || f.executive || f.uf || f.year != null;

  return (
    <div className="mx-auto max-w-[1120px] px-[max(16px,env(safe-area-inset-left))] pb-7">
      <nav className="flex items-center gap-2.5 py-4">
        <div className="font-display flex items-center gap-2 text-xl font-extrabold tracking-[-0.02em]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/emoji/scroll.webp" alt="" className="size-8 -rotate-6" />
          Lei Aberta
        </div>
        <span className="flex-1" />
        <a href="#fontes" className="text-muted-foreground hover:text-foreground mr-1 text-sm font-semibold">
          Fontes
        </a>
        <ThemeToggle />
      </nav>

      <Hero q={f.q} onQuery={(q) => { setF((s) => ({ ...s, q })); setShown(PAGE); }} onSubmit={() => document.getElementById("h-laws")?.scrollIntoView({ behavior: "smooth" })} />
      <Ticker items={policies.slice(0, 20).map((p) => ({ title: p.title, year: p.year, emoji: area(p.areas[0]).emoji }))} />

      <Facts
        items={[
          { value: rows.length, label: `${rows.length === 1 ? "lei explicada" : "leis explicadas"}${years.length ? `, de ${Math.min(...years)} a ${Math.max(...years)}` : ""}` },
          { value: new Set(rows.flatMap((r) => r.areas)).size, label: "temas" },
          { value: rows.length ? Math.round((100 * rows.filter((r) => r.sources.length).length) / rows.length) : 0, suffix: "%", label: "com link oficial" },
        ]}
      />

      <Section
        id="h-topics"
        title="Escolha um tema"
        lead="Toque em um tema para ver só as leis dele."
        action={
          active ? (
            <button onClick={() => setF(EMPTY_FILTERS)} className="bg-foreground text-background ml-auto rounded-full px-3.5 py-1.5 text-[13px] font-bold">
              Limpar filtros
            </button>
          ) : null
        }
      >
        <TopicGrid keys={topicKeys} counts={new Map(countBy(view("area"), (p) => p.areas).map((c) => [c.key, c.value]))} active={f.area} onPick={(k) => toggle("area", k)} />
        <LevelPills counts={new Map(countBy(view("level"), (p) => p.level).map((c) => [c.key, c.value]))} active={f.level} onPick={(k) => toggle("level", k)} />
      </Section>

      <Section id="h-time" title="Quando virou lei" lead="Cada barra é um ano. Toque para ver só aquele ano.">
        <YearChart rows={perYear(view("year"), lastYear)} active={f.year} onPick={(y) => toggle("year", y)} />
      </Section>

      <Section id="h-party" title="Quem propôs e quem sancionou" lead="Cada ponto é um partido, na posição dele entre esquerda e direita. Quanto maior o ponto, mais leis.">
        <PartyPlot
          author={countBy(view("author"), authorKeys)}
          executive={countBy(view("executive"), executiveKey)}
          active={{ author: f.author, executive: f.executive }}
          onPick={(k, v) => toggle(k, v)}
        />
      </Section>

      <Section id="h-map" title="De onde vêm as propostas" lead="Estado de quem propôs cada lei. Toque num estado para filtrar.">
        <BrazilMap counts={perAuthorState(view("uf"))} active={f.uf} onPick={(uf) => toggle("uf", uf)} />
      </Section>

      <Section id="h-laws" title="As leis" lead={`${plural(rows.length)}, das mais novas para as mais antigas. Toque para ver tudo.`}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
          {rows.length ? (
            rows.slice(0, shown).map((p, i) => <PolicyCard key={p.id} p={p} index={i % PAGE} onOpen={() => setOpen(p)} />)
          ) : (
            <p className="text-muted-foreground col-span-full py-8 text-center">Nenhuma lei com esses filtros. Tente outra palavra ou limpe os filtros.</p>
          )}
        </div>
        {rows.length > shown && (
          <button onClick={() => setShown((n) => n + PAGE)} className="bg-card mx-auto mt-5 block rounded-full border px-5 py-2.5 text-sm font-bold">
            Mostrar mais {Math.min(PAGE, rows.length - shown)} de {fmt.format(rows.length - shown)} restantes
          </button>
        )}
      </Section>

      <Section id="fontes" title="De onde vêm os dados" lead="Cada lei aponta para o texto oficial. Estas são as fontes que coletamos, e quando foi a última coleta.">
        <Sources sources={sources} />
      </Section>

      <footer className="text-muted-foreground mt-12 grid gap-1.5 border-t pt-4.5 text-[13px]">
        <span>
          <b>Lei Aberta</b> · projeto de código aberto. A gente descreve as leis, não dá nota para partidos nem para políticas.
        </span>
        {sample && <span>Dados de exemplo: leis federais conhecidas. Estados e municípios chegam com os próximos coletores.</span>}
        <span>Ilustrações: Fluent Emoji (Microsoft, MIT).</span>
      </footer>

      <PolicySheet policy={open} onClose={() => setOpen(null)} />
    </div>
  );
}
