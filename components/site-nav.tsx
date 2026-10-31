import Link from "next/link";
import { ThemeToggle } from "./home/theme-toggle";

/** Top bar shared by the home and the party pages. */
export function SiteNav() {
  return (
    <nav className="flex items-center gap-2.5 py-4">
      <Link href="/" className="font-display flex items-center gap-2 text-xl font-extrabold tracking-[-0.02em]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/emoji/scroll.webp" alt="" className="size-8 -rotate-6" />
        Lei Aberta
      </Link>
      <span className="flex-1" />
      <Link href="/partidos" className="text-muted-foreground hover:text-foreground mr-1 text-sm font-semibold">
        Partidos
      </Link>
      <a href="/#fontes" className="text-muted-foreground hover:text-foreground mr-1 text-sm font-semibold">
        Fontes
      </a>
      <ThemeToggle />
    </nav>
  );
}
