"use client";

import { useState } from "react";
import { EMPTY_FILTERS, type Filters, type Overview } from "@/lib/catalog";
import { writeUrlState } from "@/lib/listing";
import type { Policy } from "@/lib/types";
import type { DataSource } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { Sources } from "./sources";
import { area, plural } from "@/lib/vocab";
import { BrazilMap } from "./brazil-map";
import { Facts } from "./facts";
import { Hero, Ticker } from "./hero";
import { Pager } from "./pager";
import { PartyPlot } from "./party-plot";
import { PolicyCard } from "./policy-card";
import { PolicySheet } from "./policy-sheet";
import { Section } from "./section";
import { ThemeToggle } from "./theme-toggle";
import { LevelPills, TopicGrid } from "./topics";
import { useListing } from "./use-listing";
import { YearChart } from "./year-chart";

// Linktree of the Lenindragons collective, credited in the footer.
const LENINDRAGONS_URL = "https://linktr.ee/lenindragonsrpg";

export function Home({
  firstPage,
  overview: initial,
  pages,
  lastYear,
  sample,
  sources,
}: {
  firstPage: Policy[];
  overview: Overview;
  pages: number;
  lastYear: number;
  sample: boolean;
  sources: DataSource[];
}) {
  const list = useListing({ firstPage, overview: initial, pages, lastYear });
  const f = list.filters;
  const [open, setOpen] = useState<Policy | null>(null);
  // While the filter index loads, keep the last numbers on screen, dimmed.
  const ov = list.overview ?? initial;
  const busy = list.filtered && !list.overview;
  // Clicking the active value again clears it.
  const toggle = <K extends keyof Filters>(k: K, v: Filters[K]) => list.setFilters((s) => ({ ...s, [k]: s[k] === v ? EMPTY_FILTERS[k] : v }));
  const topicKeys = initial.topics.map((t) => t.key);
  const lawsTop = () => document.getElementById("h-laws")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const dim = cn("transition-opacity", busy && "pointer-events-none opacity-50");

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

      <Hero q={f.q} onQuery={(q) => list.setFilters((s) => ({ ...s, q }))} onSubmit={lawsTop} />
      <Ticker items={firstPage.slice(0, 20).map((p) => ({ title: p.title, year: p.year, emoji: area(p.areas[0]).emoji }))} />

      <div className={dim} aria-busy={busy}>
        <Facts
          items={[
            { value: ov.total, label: `${ov.total === 1 ? "lei explicada" : "leis explicadas"}${ov.minYear != null ? `, de ${ov.minYear} a ${ov.maxYear}` : ""}` },
            { value: ov.themes, label: "temas" },
            { value: ov.officialPct, suffix: "%", label: "com link oficial" },
          ]}
        />
      </div>

      <Section
        id="h-topics"
        title="Escolha um tema"
        lead="Toque em um tema para ver só as leis dele."
        action={
          list.filtered ? (
            <button onClick={() => list.setFilters(EMPTY_FILTERS)} className="bg-foreground text-background ml-auto rounded-full px-3.5 py-1.5 text-[13px] font-bold">
              Limpar filtros
            </button>
          ) : null
        }
      >
        <div className={dim}>
          <TopicGrid keys={topicKeys} counts={new Map(ov.topics.map((c) => [c.key, c.value]))} active={f.area} onPick={(k) => toggle("area", k)} />
          <LevelPills counts={new Map(ov.levels.map((c) => [c.key, c.value]))} active={f.level} onPick={(k) => toggle("level", k)} />
        </div>
      </Section>

      <Section id="h-time" title="Quando virou lei" lead="Cada barra é um ano. Toque para ver só aquele ano.">
        <div className={dim}>
          <YearChart rows={ov.years} active={f.year} onPick={(y) => toggle("year", y)} />
        </div>
      </Section>

      <Section id="h-party" title="Quem propôs e quem sancionou" lead="Cada ponto é um partido, na posição dele entre esquerda e direita. Quanto maior o ponto, mais leis.">
        <div className={dim}>
          <PartyPlot author={ov.author} executive={ov.executive} active={{ author: f.author, executive: f.executive }} onPick={(k, v) => toggle(k, v)} />
        </div>
      </Section>

      <Section id="h-map" title="De onde vêm as propostas" lead="Estado de quem propôs cada lei. Toque num estado para filtrar.">
        <div className={dim}>
          <BrazilMap counts={new Map(ov.ufs)} active={f.uf} onPick={(uf) => toggle("uf", uf)} />
        </div>
      </Section>

      <Section id="h-laws" title="As leis" lead={`${plural(ov.total)}, das mais novas para as mais antigas. Toque para ver tudo.`}>
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
            href={(n) => `/${writeUrlState(f, n)}`}
            onGo={(n) => {
              list.goTo(n);
              lawsTop();
            }}
          />
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
        <span>
          Mais um projeto vindo da comuna{" "}
          <a href={LENINDRAGONS_URL} target="_blank" rel="noopener noreferrer" className="text-foreground font-semibold underline underline-offset-2">
            Lenindragons
          </a>
          .
        </span>
      </footer>

      <PolicySheet policy={open} onClose={() => setOpen(null)} />
    </div>
  );
}
