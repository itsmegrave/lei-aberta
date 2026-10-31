"use client";

import { PauseIcon, PlayIcon, SearchIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { searchHref } from "@/lib/listing";
import { emojiSrc } from "@/lib/vocab";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ART: { e: string; style: React.CSSProperties; big?: boolean }[] = [
  { e: "scroll", big: true, style: { left: "27%", top: "25%", width: "46%", ["--rot" as string]: "-4deg", animationDuration: "7s" } },
  { e: "books", style: { left: "4%", top: "8%", ["--rot" as string]: "8deg", animationDelay: "-1s" } },
  { e: "stethoscope", style: { right: "2%", top: "6%", ["--rot" as string]: "-10deg", animationDelay: "-2.5s" } },
  { e: "deciduous-tree", style: { left: 0, bottom: "12%", ["--rot" as string]: "6deg", animationDelay: "-3.5s" } },
  { e: "mobile-phone", style: { right: "4%", bottom: "10%", ["--rot" as string]: "-6deg", animationDelay: "-0.5s" } },
  { e: "balance-scale", style: { left: "38%", bottom: "-2%", width: "20%", ["--rot" as string]: "5deg", animationDelay: "-4.2s" } },
  { e: "sparkles", style: { left: "40%", top: 0, width: "16%", ["--rot" as string]: "12deg", animationDelay: "-2s" } },
];

const TRY = ["internet", "mulher", "escola", "dados"];

/** Home header. The search box sends the words to the search page; nothing is filtered on the home. */
export function Hero({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <header className="grid items-center gap-6 pt-6 pb-2 md:grid-cols-[1.25fr_1fr]">
      <div className="grid min-w-0 gap-5">
        <span className="bg-card inline-flex w-fit items-center gap-2 rounded-full border py-1 pr-3 pl-1.5 text-[13px] font-semibold text-muted-foreground">
          <b className="bg-highlight rounded-full px-2 text-xs text-[#17142e]">Novo</b>
          Leis do Brasil desde 1988, sem juridiquês
        </span>
        <motion.h1
          initial={{ y: 16, opacity: 0.001 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="max-w-[16ch] text-[clamp(36px,7vw,68px)] leading-none font-extrabold tracking-[-0.035em]"
        >
          Que lei mudou{" "}
          <span className="bg-[linear-gradient(transparent_58%,var(--highlight-band)_58%,var(--highlight-band)_92%,transparent_92%)] px-[0.08em]">a sua vida?</span>
        </motion.h1>
        <p className="text-muted-foreground m-0 max-w-[52ch] text-[clamp(16px,2.2vw,19px)]">
          Cada lei em uma frase, com quem propôs, quem sancionou e o link para o texto oficial.
        </p>
        <form
          role="search"
          className="bg-card border-foreground focus-within:ring-ring/40 flex max-w-[640px] items-center gap-2.5 rounded-[18px] border-2 py-1.5 pr-1.5 pl-4 shadow-[4px_4px_0_var(--foreground)] focus-within:ring-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(q.trim());
          }}
        >
          <SearchIcon className="text-muted-foreground size-5.5 shrink-0" aria-hidden />
          <input
            id="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="escola, internet, saúde, idosos…"
            aria-label="Buscar leis"
            className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none"
          />
          <Button type="submit" size="lg" className="h-11 rounded-xl font-bold">
            Buscar
          </Button>
        </form>
        <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[13px]">
          Experimente:
          {TRY.map((t) => (
            <Link key={t} href={searchHref({ q: t })} className="bg-accent text-foreground hover:bg-primary hover:text-primary-foreground rounded-full px-3 py-1 font-semibold">
              {t === "dados" ? "dados pessoais" : t}
            </Link>
          ))}
        </div>
      </div>
      <div aria-hidden className="relative order-first aspect-square w-full max-w-[260px] justify-self-center md:order-none md:max-w-[420px]">
        <div
          className="animate-morph absolute inset-[8%]"
          style={{ background: "radial-gradient(circle at 30% 30%, var(--highlight), transparent 60%), radial-gradient(circle at 70% 70%, var(--accent), transparent 65%), var(--secondary)" }}
        />
        {ART.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={a.e}
            src={emojiSrc(a.e)}
            alt=""
            className="animate-float absolute w-[22%] drop-shadow-[0_12px_18px_rgba(23,20,46,0.18)]"
            style={a.style}
          />
        ))}
      </div>
    </header>
  );
}

/**
 * A strip of law titles sliding sideways. Decorative (the same laws are one search away), so hidden from
 * screen readers; it has a pause button because it moves for more than five seconds (WCAG 2.2.2), and
 * it stops on hover, on focus inside it and when the system asks for reduced motion.
 */
export function Ticker({ items }: { items: { title: string; year: number; emoji: string }[] }) {
  const [paused, setPaused] = useState(false);
  const row = items.map((i) => (
    <span key={i.title} className="bg-card inline-flex flex-none items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2 text-sm font-semibold whitespace-nowrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={emojiSrc(i.emoji)} alt="" className="size-5.5" />
      {i.title} · {i.year}
    </span>
  ));
  const track = cn("animate-marquee flex flex-none gap-2.5 group-hover:[animation-play-state:paused]", paused && "[animation-play-state:paused]");
  return (
    <div className="mt-7 flex items-center gap-2">
      <div aria-hidden className="group flex min-w-0 flex-1 gap-2.5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className={track}>{row}</div>
        <div className={track}>{row}</div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? "Continuar a faixa de leis" : "Pausar a faixa de leis"}
        className="bg-card text-muted-foreground hover:text-foreground grid size-9 shrink-0 place-items-center rounded-full border motion-reduce:hidden"
      >
        {paused ? <PlayIcon className="size-4" aria-hidden /> : <PauseIcon className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
