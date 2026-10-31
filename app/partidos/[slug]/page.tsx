import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, ExternalLinkIcon } from "lucide-react";
import { Facts } from "@/components/home/facts";
import { Panel, Section } from "@/components/home/section";
import { PartyYears } from "@/components/parties/party-years";
import { PartyDot, PositionBar } from "@/components/parties/spectrum";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { loadPartyStats } from "@/lib/data";
import { writeUrlState } from "@/lib/listing";
import { EMPTY_FILTERS } from "@/lib/catalog";
import { SPECTRUM_SOURCE } from "@/lib/party-spectrum";
import { PARTIES, PARTIES_PATH, partyBySlug, partyPath, tseUrl, TSE_PARTIES_URL } from "@/lib/parties";
import { lawPath } from "@/lib/share";
import { partyDescription, partyJsonLd, partyTitle, SITE_NAME } from "@/lib/seo";
import { area, emojiSrc, fmt, lawLabel, plural } from "@/lib/vocab";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return PARTIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = partyBySlug((await params).slug);
  if (!p) return {};
  const s = (await loadPartyStats()).stats.get(p.slug)!;
  const title = partyTitle(p);
  const description = partyDescription(p, s);
  return {
    title,
    description,
    alternates: { canonical: partyPath(p.slug) },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "pt_BR", title, description, url: partyPath(p.slug) },
    twitter: { card: "summary_large_image", title, description },
  };
}

const dateBR = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const homeWith = (f: Partial<typeof EMPTY_FILTERS>) => `/${writeUrlState({ ...EMPTY_FILTERS, ...f }, 1)}#h-laws`;
const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export default async function PartyPage({ params }: Props) {
  const p = partyBySlug((await params).slug);
  if (!p) notFound();
  const { stats, byId } = await loadPartyStats();
  const s = stats.get(p.slug)!;
  const recent = s.recent.map((id) => byId.get(id)!).filter(Boolean);
  const active = s.years.filter((y) => y.proposed || y.signed);
  const years = active.length ? s.years.slice(s.years.indexOf(active[0])) : s.years;

  return (
    <div className="mx-auto max-w-[1120px] px-[max(16px,env(safe-area-inset-left))] pb-7">
      <JsonLd data={partyJsonLd(p)} />
      <SiteNav />
      <Link href={PARTIES_PATH} className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm font-semibold">
        <ArrowLeftIcon className="size-4" /> Todos os partidos
      </Link>

      <header className="mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <PartyDot party={p.short} className="size-5" />
            <h1 className="font-display text-[clamp(40px,8vw,72px)] leading-[0.95] font-extrabold tracking-[-0.035em]">{p.short}</h1>
          </div>
          {p.name !== p.short && <p className="mt-2 text-xl font-bold">{p.name}</p>}
          <p className="text-muted-foreground mt-3 max-w-[600px] text-[17px]">{p.about}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.website && (
              <a href={p.website} {...external} className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold">
                Site oficial <ExternalLinkIcon className="size-4" />
              </a>
            )}
            <a href={tseUrl(p)} {...external} className="bg-card inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold">
              Registro no TSE <ExternalLinkIcon className="size-4" />
            </a>
          </div>
        </div>
        <Panel className="grid content-start gap-3">
          <dl className="m-0 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted-foreground text-xs font-bold tracking-[0.06em] uppercase">Número</dt>
              <dd className="font-display m-0 text-3xl font-extrabold">{p.number}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-bold tracking-[0.06em] uppercase">Registro no TSE</dt>
              <dd className="m-0 text-sm font-bold">{dateBR(p.registeredAt)}</dd>
            </div>
          </dl>
          <div>
            <div className="text-muted-foreground mb-1.5 text-xs font-bold tracking-[0.06em] uppercase">Posição segundo especialistas</div>
            <PositionBar party={p.short} />
          </div>
        </Panel>
      </header>

      <Facts
        items={[
          { value: s.proposed, label: s.proposed === 1 ? "lei proposta por parlamentares do partido" : "leis propostas por parlamentares do partido" },
          { value: s.signed, label: s.signed === 1 ? "lei sancionada por governante do partido" : "leis sancionadas por governantes do partido" },
          { value: s.topics.length, label: s.topics.length === 1 ? "tema" : "temas" },
        ]}
      />

      <Section id="p-history" title="Linha do tempo" lead="Fundação, mudanças de nome e fusões, no plano nacional.">
        <Panel>
          <ol className="m-0 grid list-none gap-0 p-0">
            {p.history.map((e, i) => (
              <li key={i} className="grid grid-cols-[64px_1fr] gap-3 border-b py-2.5 last:border-b-0">
                <span className="font-display text-lg leading-tight font-extrabold">{e.year ?? "—"}</span>
                <span className="text-[15px]">{e.text}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </Section>

      {(s.proposed > 0 || s.signed > 0) && (
        <Section id="p-years" title="Leis por ano" lead="Leis propostas por parlamentares do partido e leis sancionadas por presidentes, governadores e prefeitos do partido. São dados separados.">
          <PartyYears years={years} />
        </Section>
      )}

      {s.topics.length > 0 && (
        <Section id="p-topics" title="Temas das leis que propôs" lead="Toque para ver essas leis na página inicial.">
          <div className="flex flex-wrap gap-2">
            {s.topics.map((t) => {
              const a = area(t.key);
              return (
                <Link
                  key={t.key}
                  href={homeWith({ author: p.short, area: t.key })}
                  className="inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2 text-sm font-bold"
                  style={{ background: `var(--t-${a.tint}-bg)`, color: `var(--t-${a.tint})` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={emojiSrc(a.emoji)} alt="" className="size-6" />
                  <span className="text-foreground">{a.label}</span>
                  <span>{fmt.format(t.value)}</span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {s.codes.length > 0 && (
        <Section id="p-names" title="Com que nome aparece nas leis" lead="Cada lei guarda o partido da época. Aqui somamos todos os nomes no partido de hoje.">
          <Panel>
            <ul className="m-0 grid list-none gap-0 p-0">
              {s.codes.map((c) => (
                <li key={c.code} className="flex flex-wrap items-baseline gap-x-3 border-b py-2 last:border-b-0">
                  <b className="font-display min-w-[110px] text-base">{c.code}</b>
                  <span className="text-muted-foreground text-sm">
                    {c.first === c.last ? c.first : `${c.first} a ${c.last}`} · {c.proposed} {c.proposed === 1 ? "proposta" : "propostas"} · {c.signed}{" "}
                    {c.signed === 1 ? "sancionada" : "sancionadas"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}

      <Section
        id="p-laws"
        title="Leis mais recentes"
        lead={recent.length ? "As mais novas que o partido propôs ou sancionou." : "Ainda não há leis deste partido no catálogo."}
      >
        {recent.length > 0 && (
          <>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3 p-0">
              {recent.map((law) => {
                const a = area(law.areas[0]);
                return (
                  <li key={law.id}>
                    <Link href={lawPath(law.id)} className="group block h-full">
                      <Panel className="flex h-full flex-col gap-1.5 transition-transform group-hover:-translate-y-0.5">
                        <div className="text-muted-foreground flex items-center gap-2 text-[13px] font-semibold">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={emojiSrc(a.emoji)} alt="" className="size-6" />
                          {lawLabel(law)}/{law.year}
                        </div>
                        <h3 className="text-[17px] leading-[1.2] font-bold">{law.title}</h3>
                        <p className="text-muted-foreground m-0 line-clamp-2 text-sm">{law.summary}</p>
                      </Panel>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {s.proposed > 0 && (
                <Link href={homeWith({ author: p.short })} className="bg-card inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-bold">
                  {s.proposed === 1 ? "Ver a lei que propôs" : `Ver as ${plural(s.proposed)} que propôs`} <ArrowRightIcon className="size-3.5" />
                </Link>
              )}
              {s.signed > 0 && (
                <Link href={homeWith({ executive: p.short })} className="bg-card inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-bold">
                  {s.signed === 1 ? "Ver a lei que sancionou" : `Ver as ${plural(s.signed)} que sancionou`} <ArrowRightIcon className="size-3.5" />
                </Link>
              )}
            </div>
          </>
        )}
      </Section>

      <section aria-labelledby="p-sources" className="mt-12">
        <h2 id="p-sources" className="text-lg font-extrabold">Fontes</h2>
        <ul className="text-muted-foreground mt-2 grid gap-1 pl-5 text-sm">
          <li>
            <a className="text-primary underline" href={tseUrl(p)} {...external}>
              Página do {p.short} no TSE
            </a>{" "}
            e{" "}
            <a className="text-primary underline" href={TSE_PARTIES_URL} {...external}>
              lista de partidos registrados
            </a>
            : nome, número, data de registro e site.
          </li>
          {p.sources?.map((src) => (
            <li key={src.url}>
              <a className="text-primary underline" href={src.url} {...external}>
                {src.label}
              </a>
            </li>
          ))}
          <li>
            Posição:{" "}
            <a className="text-primary underline" href={SPECTRUM_SOURCE.url} {...external}>
              {SPECTRUM_SOURCE.label}
            </a>
            . Nomes antigos usam a nota do mesmo partido; partidos criados depois da pesquisa ficam sem posição.
          </li>
          <li>Leis: catálogo do Lei Aberta, com o texto oficial em cada lei.</li>
        </ul>
      </section>
      <SiteFooter />
    </div>
  );
}
