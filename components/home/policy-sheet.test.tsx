import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { law } from "@/test/fixtures";
import { PolicyDetails, PolicySheet } from "./policy-sheet";

const byDeputy = law({
  authors: [
    { name: "Ana Souza", kind: "deputy", party: "PT", uf: "SP" },
    { name: "Bruno Lima", kind: "deputy", party: "PSDB", uf: "MG" },
  ],
  parties: ["PT", "PSDB"],
  executive: { name: "Fernando Henrique Cardoso", office: "Presidente", party: "PSDB" },
  bill: "PL 1/1999",
  areas: ["saude", "educacao"],
});

const box = (label: string) => screen.getByText(label).parentElement!;

describe("PolicyDetails", () => {
  it("shows topics, level, reference, status and the bill", () => {
    render(<PolicyDetails p={byDeputy} />);
    expect(screen.getByRole("heading", { level: 1, name: "Lei Orgânica da Saúde" })).toBeInTheDocument();
    expect(screen.getByText("Saúde · Educação")).toBeInTheDocument();
    expect(screen.getByText("Federal · Brasil · Lei 8.080/1990")).toBeInTheDocument();
    expect(screen.getByText("Sancionada · origem: PL 1/1999")).toBeInTheDocument();
  });

  it("keeps the author's party and the executive's party apart", () => {
    render(<PolicyDetails p={byDeputy} />);
    const proposed = box("Quem propôs");
    expect(proposed).toHaveTextContent("Ana Souza e mais 1");
    expect(proposed).toHaveTextContent("PT · Câmara dos Deputados · SP");
    const signed = box("Quem sancionou");
    expect(signed).toHaveTextContent("Fernando Henrique Cardoso");
    expect(signed).toHaveTextContent("PSDB · Presidente");
    expect(signed).not.toHaveTextContent("PT ");
  });

  it("colors party dots from the spectrum, gray when the party has no score", () => {
    render(<PolicyDetails p={law({ authors: [{ name: "C", kind: "deputy", party: "XYZ", uf: null }], executive: { name: "E", office: "Presidente", party: "PT" } })} />);
    const dots = document.querySelectorAll("i.rounded-full");
    expect(dots).toHaveLength(2);
    expect((dots[0] as HTMLElement).style.background).toBe("rgb(212, 211, 205)"); // "none" gray, light theme
    expect((dots[1] as HTMLElement).style.background).not.toBe("rgb(212, 211, 205)");
  });

  it("links the party to its page and names today's party when it changed", () => {
    render(<PolicyDetails p={law({ year: 1995, authors: [{ name: "Ana", kind: "deputy", party: "PFL", uf: "BA" }], executive: { name: "E", office: "Presidente", party: "PMDB" } })} />);
    expect(screen.getByRole("link", { name: "PFL" })).toHaveAttribute("href", "/partidos/uniao");
    expect(box("Quem propôs")).toHaveTextContent("(hoje União Brasil)");
    expect(screen.getByRole("link", { name: "PMDB" })).toHaveAttribute("href", "/partidos/mdb");
    expect(box("Quem sancionou")).toHaveTextContent("(hoje MDB)");
  });

  it("a party we don't know is plain text, not a link", () => {
    render(<PolicyDetails p={law({ authors: [{ name: "Ana", kind: "deputy", party: "XYZ", uf: null }] })} />);
    expect(box("Quem propôs")).toHaveTextContent("XYZ");
    expect(screen.queryByRole("link", { name: "XYZ" })).toBeNull();
  });

  it("names institutions instead of a party", () => {
    render(<PolicyDetails p={law()} />);
    expect(box("Quem propôs")).toHaveTextContent("Poder Executivo");
    expect(box("Quem propôs")).toHaveTextContent("Projeto enviado pelo governo");
  });

  it("a lawmaker with no known party is 'não identificado', not 'sem partido'", () => {
    render(<PolicyDetails p={law({ authors: [{ name: "Ana", kind: "senator", party: null, uf: "RS" }] })} />);
    expect(box("Quem propôs")).toHaveTextContent("Partido não identificado · Senado · RS");
  });

  it("says when there is no author or executive on record", () => {
    render(<PolicyDetails p={law({ authors: [], executive: null })} />);
    expect(box("Quem propôs")).toHaveTextContent("Não informado");
    expect(screen.getByText("Autoria não encontrada nas fontes oficiais")).toBeInTheDocument();
    expect(box("Quem sancionou")).toHaveTextContent("Não informado");
    expect(box("Quem sancionou")).toHaveTextContent("Sem partido");
  });

  it("links every official source in a new tab", () => {
    const p = law({ sources: [{ label: "Planalto", url: "https://planalto.gov.br/a" }, { label: "Câmara", url: "https://camara.leg.br/b" }] });
    render(<PolicyDetails p={p} />);
    const links = screen.getAllByRole("link", { name: /Ler o texto oficial/ });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["https://planalto.gov.br/a", "https://camara.leg.br/b"]);
    for (const a of links) expect(a).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Câmara")).toBeInTheDocument();
  });
});

describe("PolicySheet", () => {
  it("is closed without a policy", () => {
    render(<PolicySheet policy={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens as a dialog titled by the law and closes on Escape", () => {
    const onClose = vi.fn();
    render(<PolicySheet policy={byDeputy} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Lei Orgânica da Saúde" });
    expect(within(dialog).getByText("Cria o SUS.")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
