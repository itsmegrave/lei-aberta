import Link from "next/link";
import { ThemeToggle } from "./home/theme-toggle";

const navLink = "text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full px-2 py-2 text-sm font-semibold sm:px-2.5";

/** Top bar shared by every page. Links get padding so each tap target is at least 24px (WCAG 2.5.8). */
export function SiteNav() {
  return (
    <header>
      <nav aria-label="Principal" className="flex items-center gap-0.5 py-4 sm:gap-1">
        <Link href="/" className="font-display mr-1 flex items-center gap-2 text-xl font-extrabold tracking-[-0.02em] whitespace-nowrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/emoji/scroll.webp" alt="" className="size-8 -rotate-6" />
          Lei Aberta
        </Link>
        <span className="flex-1" />
        <Link href="/busca" className={`${navLink} hidden sm:inline`}>
          Buscar
        </Link>
        <Link href="/partidos" className={navLink}>
          Partidos
        </Link>
        <a href="/#fontes" className={navLink}>
          Fontes
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}
