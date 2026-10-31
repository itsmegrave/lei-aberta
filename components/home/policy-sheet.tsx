"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { NO_PARTY, UNKNOWN_PARTY } from "@/lib/catalog";
import { partyScore, spectrumColor } from "@/lib/party-spectrum";
import type { Policy } from "@/lib/types";
import { area, AUTHOR_KIND, emojiSrc, LEVELS, statusLabel } from "@/lib/vocab";
import { lawLabel } from "./policy-card";
import { ShareButtons } from "./share-button";
import { useDark } from "./use-dark";

function PartyBadge({ party, missing = NO_PARTY }: { party: string | null; missing?: string }) {
  const dark = useDark();
  if (!party) return <>{missing}</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="size-2.5 rounded-full" style={{ background: spectrumColor(partyScore(party), dark ? "dark" : "light") }} />
      {party}
    </span>
  );
}

export function PolicySheet({ policy, onClose }: { policy: Policy | null; onClose: () => void }) {
  return (
    <Sheet open={!!policy} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[88dvh] w-full max-w-[620px] gap-3.5 overflow-y-auto rounded-t-[26px] px-5 pt-2.5 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {policy && <PolicyDetails p={policy} inSheet />}
      </SheetContent>
    </Sheet>
  );
}

/** Law details, shared by the home sheet and the law's own page (/lei/[id]). */
export function PolicyDetails({ p, inSheet = false }: { p: Policy; inSheet?: boolean }) {
  // Sheet title/description need the dialog context; the standalone page uses plain elements.
  const Title = inSheet ? SheetTitle : "h1";
  const Description = inSheet ? SheetDescription : "p";
  const a = area(p.areas[0]);
  const lvl = LEVELS.find((l) => l.key === p.level)!;
  const author = p.authors[0];
  return (
    <>
      {inSheet && <div className="bg-border mx-auto mb-1 h-1.5 w-11 rounded-full" />}
      <div className="flex items-center gap-3 rounded-[18px] p-4" style={{ background: `var(--t-${a.tint}-bg)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={emojiSrc(a.emoji)} alt="" className="size-13" />
        <div>
          <div className="text-[13px] font-bold">{p.areas.map((x) => area(x).label).join(" · ")}</div>
          <div className="text-muted-foreground text-[13px]">
            {lvl.label} · {p.jurisdiction} · {lawLabel(p, true)}/{p.year}
          </div>
          <div className="text-muted-foreground text-[13px]">
            {statusLabel(p.status)}
            {p.bill ? ` · origem: ${p.bill}` : ""}
          </div>
        </div>
      </div>
      <Title className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em]">{p.title}</Title>
      <Description className="text-foreground m-0 text-[17px]">{p.summary}</Description>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="bg-secondary rounded-2xl px-3.5 py-3">
          <div className="text-muted-foreground text-xs font-bold tracking-[0.06em] uppercase">Quem propôs</div>
          {/* Records from the Diários Oficiais can come without an author. */}
          {author ? (
            <>
              <div className="mt-0.5 text-base font-bold">
                {author.kind === "executive" ? "Poder Executivo" : author.name}
                {p.authors.length > 1 && <span className="text-muted-foreground text-sm font-semibold"> e mais {p.authors.length - 1}</span>}
              </div>
              <div className="text-muted-foreground text-[13px]">
                {!["deputy", "senator", "state-deputy", "councilor"].includes(author.kind) ? (
                  AUTHOR_KIND[author.kind] ?? AUTHOR_KIND.other
                ) : (
                  <>
                    <PartyBadge party={author.party} missing={UNKNOWN_PARTY} /> · {AUTHOR_KIND[author.kind]}
                    {author.uf ? ` · ${author.uf}` : ""}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="mt-0.5 text-base font-bold">Não informado</div>
          )}
        </div>
        <div className="bg-secondary rounded-2xl px-3.5 py-3">
          <div className="text-muted-foreground text-xs font-bold tracking-[0.06em] uppercase">Quem sancionou</div>
          <div className="mt-0.5 text-base font-bold">{p.executive?.name ?? "Não informado"}</div>
          <div className="text-muted-foreground text-[13px]">
            <PartyBadge party={p.executive?.party ?? null} /> · {p.executive?.office}
          </div>
        </div>
      </div>
      {p.sources.map((s) => (
        <div key={s.url} className="grid gap-1">
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="bg-foreground text-background flex items-center justify-center gap-2 rounded-2xl p-3.5 text-base font-extrabold">
            Ler o texto oficial <ExternalLinkIcon className="size-4" />
          </a>
          <p className="text-muted-foreground m-0 text-center text-xs">{s.label}</p>
        </div>
      ))}
      <ShareButtons p={p} />
      <p className="text-muted-foreground m-0 text-xs">Partido de quem propôs é o da época da proposta. Partido de quem sancionou é um dado separado.</p>
    </>
  );
}
