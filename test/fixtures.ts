import type { Policy } from "@/lib/types";

/** A complete federal law record; override fields per test. */
export function law(over: Partial<Policy> = {}): Policy {
  return {
    id: "federal-lei-8080-1990",
    level: "federal",
    jurisdiction: "Brasil",
    type: "lei",
    number: "8.080",
    title: "Lei Orgânica da Saúde",
    summary: "Cria o SUS.",
    year: 1990,
    presentedAt: null,
    status: "sancionada",
    areas: ["saude"],
    parties: [],
    authors: [{ name: "Poder Executivo", kind: "executive", party: null, uf: null }],
    executive: { name: "Fernando Collor", office: "Presidente", party: "PRN" },
    sources: [{ label: "Planalto", url: "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm" }],
    ...over,
  };
}
