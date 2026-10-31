// Linktree of the Lenindragons collective, credited in the footer.
const LENINDRAGONS_URL = "https://linktr.ee/lenindragonsrpg";
// Maker credit and source repository, also in the footer.
const MAKER_URL = "https://github.com/itsmegrave";
const REPO_URL = "https://github.com/itsmegrave/lei-aberta";
const footerLink = "text-foreground font-semibold underline underline-offset-2";

export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="text-muted-foreground mt-12 grid gap-1.5 border-t pt-4.5 text-[13px]">
      <span>
        <b>Lei Aberta</b> · projeto de código aberto. A gente descreve as leis, não dá nota para partidos nem para políticas.
      </span>
      {children}
      <span>Ilustrações: Fluent Emoji (Microsoft, MIT).</span>
      <span>
        Mais um projeto vindo da comuna{" "}
        <a href={LENINDRAGONS_URL} target="_blank" rel="noopener noreferrer" className={footerLink} aria-label="Lenindragons (abre em nova aba)">
          Lenindragons
        </a>
        .
      </span>
      <span>
        Feito com{" "}
        <span role="img" aria-label="amor">
          💜
        </span>{" "}
        por{" "}
        <a href={MAKER_URL} target="_blank" rel="noopener noreferrer" className={footerLink} aria-label="itsmegrave (abre em nova aba)">
          itsmegrave
        </a>
        . Código no{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={footerLink} aria-label="GitHub (abre em nova aba)">
          GitHub
        </a>
        .
      </span>
    </footer>
  );
}
