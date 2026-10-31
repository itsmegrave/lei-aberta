"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isFiltered, type Filters, type Overview } from "@/lib/catalog";
import { readUrlState, SEARCH_PATH, searchHref } from "@/lib/listing";
import type { DataSource } from "@/lib/sources";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Sources } from "./sources";
import { BrazilMap } from "./brazil-map";
import { Facts } from "./facts";
import { Hero, Ticker } from "./hero";
import { PartyPlot } from "./party-plot";
import { Section } from "./section";
import { News } from "./news";
import { LevelPills, TopicGrid } from "./topics";
import { YearChart } from "./year-chart";

/**
 * The home: numbers and charts for the whole catalog, no law list. Every pick (a topic, a level,
 * a year, a party, a state, a search) opens the search page with that filter, where the laws are listed.
 */
export function Home({
  overview: ov,
  ticker,
  sample,
  sources,
}: {
  overview: Overview;
  ticker: { title: string; year: number; emoji: string }[];
  sample: boolean;
  sources: DataSource[];
}) {
  const router = useRouter();
  const go = (f: Partial<Filters>) => router.push(searchHref(f));

  // Filtered links made before the search page existed (/?tema=saude) now open it.
  useEffect(() => {
    const { filters, page } = readUrlState(window.location.search);
    if (isFiltered(filters) || page > 1) router.replace(`${SEARCH_PATH}${window.location.search}`);
  }, [router]);

  return (
    <div className="mx-auto max-w-[1120px] px-[max(16px,env(safe-area-inset-left))] pb-7">
      <SiteNav />

      <main id="conteudo" tabIndex={-1} className="outline-none">
      <Hero onSearch={(q) => go({ q })} />
      <Ticker items={ticker} />

      <Facts
        items={[
          { value: ov.total, label: `${ov.total === 1 ? "lei explicada" : "leis explicadas"}${ov.minYear != null ? `, de ${ov.minYear} a ${ov.maxYear}` : ""}` },
          { value: ov.themes, label: "temas" },
          { value: ov.officialPct, suffix: "%", label: "com link oficial" },
        ]}
      />

      <Section
        id="h-topics"
        title="Escolha um tema"
        lead="Toque em um tema para ver as leis dele."
        action={
          <Link href={SEARCH_PATH} className="bg-foreground text-background ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold">
            Ver todas as leis <ArrowRightIcon className="size-3.5" />
          </Link>
        }
      >
        <TopicGrid keys={ov.topics.map((t) => t.key)} counts={new Map(ov.topics.map((c) => [c.key, c.value]))} href={(area) => searchHref({ area })} />
        <LevelPills counts={new Map(ov.levels.map((c) => [c.key, c.value]))} active="" onPick={(level) => go({ level })} />
      </Section>

      <Section id="h-time" collapsible title="Quando virou lei" lead="Cada barra é um ano. Toque para ver as leis daquele ano.">
        <YearChart rows={ov.years} active={null} onPick={(year) => go({ year })} />
      </Section>

      <Section id="h-party" collapsible title="Quem propôs e quem sancionou" lead="Cada ponto é um partido, na posição dele entre esquerda e direita. Quanto maior o ponto, mais leis.">
        <PartyPlot author={ov.author} executive={ov.executive} active={{ author: "", executive: "" }} onPick={(k, v) => go({ [k]: v })} />
      </Section>

      <Section id="h-map" collapsible title="De onde vêm as propostas" lead="Estado de quem propôs cada lei. Toque num estado para ver as leis dele.">
        <BrazilMap counts={new Map(ov.ufs)} active="" onPick={(uf) => go({ uf })} />
      </Section>

      <Section id="fontes" collapsible title="De onde vêm os dados" lead="Cada lei aponta para o texto oficial. Estas são as fontes que coletamos, e quando foi a última coleta.">
        <Sources sources={sources} />
      </Section>

      <Section id="noticias" title="Notícias da política" lead="As manchetes mais recentes de veículos com linhas editoriais diferentes. Toque para ler no site de cada um.">
        <News />
      </Section>
      </main>

      <SiteFooter>{sample && <span>Dados de exemplo: leis federais conhecidas. Estados e municípios chegam com os próximos coletores.</span>}</SiteFooter>
    </div>
  );
}
