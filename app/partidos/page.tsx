import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { PartyDot, PositionBar } from "@/components/parties/spectrum";
import { Panel, Section } from "@/components/home/section";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { loadPartyStats } from "@/lib/data";
import { SPECTRUM_SOURCE } from "@/lib/party-spectrum";
import { directoryOrder } from "@/lib/party-stats";
import { formerCodes, PARTIES_PATH, partyPath, TSE_PARTIES_URL } from "@/lib/parties";
import { PARTIES_DESCRIPTION, PARTIES_TITLE, partiesJsonLd, SITE_NAME } from "@/lib/seo";
import { fmt } from "@/lib/vocab";

export const metadata: Metadata = {
  title: PARTIES_TITLE,
  description: PARTIES_DESCRIPTION,
  alternates: { canonical: PARTIES_PATH },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "pt_BR", title: PARTIES_TITLE, description: PARTIES_DESCRIPTION, url: PARTIES_PATH },
  twitter: { card: "summary_large_image", title: PARTIES_TITLE, description: PARTIES_DESCRIPTION },
};

export default async function PartiesPage() {
  const { stats } = await loadPartyStats();
  const parties = directoryOrder(stats);
  return (
    <div className="mx-auto max-w-[1120px] px-[max(16px,env(safe-area-inset-left))] pb-7">
      <JsonLd data={partiesJsonLd(parties)} />
      <SiteNav />
      <header className="mt-6 max-w-[720px]">
        <h1 className="font-display text-[clamp(34px,6vw,56px)] leading-[1.02] font-extrabold tracking-[-0.03em]">Partidos</h1>
        <p className="text-muted-foreground mt-3 text-[17px]">
          Os {parties.length} partidos registrados no TSE hoje: de onde cada um veio, o site oficial e as leis do catálogo. Partidos que mudaram de nome
          ou se juntaram a outros contam pelo nome de hoje: o PMDB está no MDB, o PFL e o DEM estão no União Brasil.
        </p>
      </header>

      <Section id="p-list" title="Todos os partidos" lead="Em ordem de leis no catálogo. A cor e a barra mostram a posição entre esquerda e direita, segundo especialistas.">
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5 p-0">
          {parties.map((p) => {
            const s = stats.get(p.slug)!;
            const former = formerCodes(p.slug);
            return (
              <li key={p.slug}>
                <Link href={partyPath(p.slug)} className="group block h-full">
                  <Panel className="flex h-full flex-col gap-2.5 transition-transform group-hover:-translate-y-0.5">
                    <div className="flex items-center gap-2">
                      <PartyDot party={p.short} className="size-3.5" />
                      <span className="font-display min-w-0 truncate text-[24px] leading-none font-extrabold tracking-[-0.02em]">{p.short}</span>
                      <span className="bg-secondary text-muted-foreground ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">nº {p.number}</span>
                    </div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    {former.length > 0 && <div className="text-muted-foreground text-xs">Inclui: {former.slice(0, 5).join(", ")}{former.length > 5 ? "…" : ""}</div>}
                    <PositionBar party={p.short} compact />
                    <div className="text-muted-foreground mt-auto flex flex-wrap gap-x-3 text-[13px]">
                      <span><b className="text-foreground">{fmt.format(s.proposed)}</b> {s.proposed === 1 ? "proposta" : "propostas"}</span>
                      <span><b className="text-foreground">{fmt.format(s.signed)}</b> {s.signed === 1 ? "sancionada" : "sancionadas"}</span>
                    </div>
                    <span className="text-primary flex items-center gap-1 text-[13px] font-bold">
                      Ver história e leis <ArrowRightIcon className="size-3.5" />
                    </span>
                  </Panel>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <p className="text-muted-foreground mt-8 text-xs">
        Nome, número, data de registro e site:{" "}
        <a className="text-primary underline" href={TSE_PARTIES_URL} target="_blank" rel="noopener noreferrer">
          lista de partidos registrados no TSE
        </a>
        . Posição: média de especialistas em{" "}
        <a className="text-primary underline" href={SPECTRUM_SOURCE.url} target="_blank" rel="noopener noreferrer">
          {SPECTRUM_SOURCE.label}
        </a>
        ; partidos criados ou registrados depois da pesquisa ficam sem posição. Nas leis, o partido de quem propôs continua sendo o da época.
      </p>
      <SiteFooter />
    </div>
  );
}
