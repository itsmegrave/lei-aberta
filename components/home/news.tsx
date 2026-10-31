"use client";

import { ExternalLinkIcon, LockIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/news";
import { timeAgo } from "@/lib/sources";
import { Panel } from "./section";

export const NEWS_API = "/api/noticias";

type State = { status: "loading" } | { status: "done"; items: NewsItem[]; outlets: string[] } | { status: "error" };

/** Latest political headlines, loaded after the page so the static home never waits on outside sites. */
export function News() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [now, setNow] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(NEWS_API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { items: NewsItem[]; outlets: string[] }) => live && setState({ status: "done", items: d.items ?? [], outlets: d.outlets ?? [] }))
      .catch(() => live && setState({ status: "error" }));
    setNow(Date.now());
    return () => {
      live = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5" aria-busy="true" aria-label="Carregando notícias">
        {Array.from({ length: 6 }, (_, i) => (
          <Panel key={i} className="bg-secondary h-[118px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (state.status === "error" || state.items.length === 0) {
    return <p className="text-muted-foreground text-sm font-semibold">Não conseguimos carregar as notícias agora. Tente de novo mais tarde.</p>;
  }

  return (
    <>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5 p-0">
        {state.items.map((n) => (
          <li key={n.url} className="min-w-0">
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block h-full">
              <Panel className="flex h-full flex-col gap-2 overflow-hidden transition-transform group-hover:-translate-y-0.5">
                {n.image && <Thumb src={n.image} />}
                <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <span className="bg-secondary text-foreground rounded-full px-2 py-0.5">{n.outlet}</span>
                  {n.paywall && (
                    <span className="inline-flex items-center gap-1" title="Este site pode pedir assinatura para ler a notícia inteira">
                      <LockIcon className="size-3" aria-hidden />
                      pode pedir assinatura
                    </span>
                  )}
                  <time dateTime={n.date} className="ml-auto shrink-0">{now ? timeAgo(n.date, now) : new Date(n.date).toLocaleDateString("pt-BR")}</time>
                </div>
                <p className="font-display m-0 text-[16px] leading-snug font-bold group-hover:underline">{n.title}</p>
                {n.summary && <p className="text-muted-foreground m-0 line-clamp-3 text-sm">{n.summary}</p>}
                <span className="text-primary mt-auto inline-flex items-center gap-1 text-xs font-bold">
                  Ler no site: {n.outlet} <ExternalLinkIcon className="size-3.5" />
                  <span className="sr-only">(abre em nova aba)</span>
                </span>
              </Panel>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-3 text-xs">
        Manchetes dos feeds públicos de {state.outlets.join(", ")}. Mostramos o título, o resumo e a imagem que cada veículo publica no seu feed, com o link para a notícia completa no site dele. Veículos de linhas editoriais diferentes. Alguns pedem assinatura e liberam poucas notícias grátis por mês.
      </p>
    </>
  );
}

/** The outlet's preview image, loaded from its own server; hidden if it fails to load. */
function Thumb({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setOk(false)} className="-mx-4.5 -mt-4.5 mb-1 aspect-[16/9] w-[calc(100%+36px)] max-w-none object-cover" />
  );
}
