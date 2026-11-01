import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS, overview, toRow } from "@/lib/catalog";
import { encodeIndex, PAGE_SIZE, pageFile, toCard } from "@/lib/listing";
import type { Policy } from "@/lib/types";
import { law } from "@/test/fixtures";
import { Results, resultsTitle } from "./results";

// 30 laws: every third is about education and by a PT deputy from SP.
const catalog: Policy[] = Array.from({ length: 30 }, (_, i) =>
  law({
    id: `lei-${i}`,
    title: `Lei número ${i}`,
    year: 2020 - Math.floor(i / 10),
    areas: [i % 3 === 0 ? "educacao" : "saude"],
    authors: [{ name: `Autor ${i}`, kind: "deputy", party: i % 3 === 0 ? "PT" : "MDB", uf: "SP" }],
  }),
);
const rows = catalog.map((p, i) => toRow(p, i));
const files: Record<string, unknown> = { "indice.json": encodeIndex(rows) };
for (let n = 1; n * PAGE_SIZE - PAGE_SIZE < catalog.length; n++) files[pageFile(n)] = catalog.slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE).map(toCard);

const props = {
  firstPage: catalog.slice(0, PAGE_SIZE).map(toCard),
  overview: overview(rows, EMPTY_FILTERS, 2020).overview,
  pages: 2,
  lastYear: 2020,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = files[url.replace("/dados/", "")];
      return body ? new Response(JSON.stringify(body)) : new Response("not found", { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const cards = () => screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/lei/"));

describe("resultsTitle", () => {
  it("names the search words, then the topic, then falls back", () => {
    expect(resultsTitle(EMPTY_FILTERS)).toBe("Todas as leis");
    expect(resultsTitle({ ...EMPTY_FILTERS, q: " escola ", area: "saude" })).toBe("Resultados para “escola”");
    expect(resultsTitle({ ...EMPTY_FILTERS, area: "saude" })).toBe("Leis sobre Saúde");
    expect(resultsTitle({ ...EMPTY_FILTERS, uf: "SP" })).toBe("Leis encontradas");
  });
});

describe("Results", () => {
  it("lists every law, newest first, when nothing is filtered", () => {
    window.history.replaceState(null, "", "/busca");
    render(<Results {...props} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Todas as leis");
    expect(screen.getByText(/30 leis, das mais novas/)).toBeInTheDocument();
    expect(cards()).toHaveLength(PAGE_SIZE);
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("applies the topic from the address bar, so a home tile lands on its laws", async () => {
    window.history.replaceState(null, "", "/busca?tema=educacao");
    render(<Results {...props} />);
    await waitFor(() => expect(screen.getByText(/10 leis, das mais novas/)).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Leis sobre Educação");
    expect(screen.getByRole("button", { name: /Educação/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(cards()).toHaveLength(10));
  });

  it("shows chart filters as removable chips", async () => {
    window.history.replaceState(null, "", "/busca?autor=PT&uf=SP");
    render(<Results {...props} />);
    await waitFor(() => expect(screen.getByText(/10 leis, das mais novas/)).toBeInTheDocument());
    const chip = screen.getByRole("button", { name: "Tirar filtro Proposta por: PT" });
    fireEvent.click(chip);
    await waitFor(() => expect(screen.getByText(/30 leis, das mais novas/)).toBeInTheDocument());
    expect(window.location.search).toBe("?uf=SP");
    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveValue("SP");
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(window.location.pathname + window.location.search).toBe("/busca");
  });

  it("searches as you type and keeps the words in the address bar", async () => {
    window.history.replaceState(null, "", "/busca");
    render(<Results {...props} />);
    fireEvent.change(within(screen.getByRole("search")).getByRole("searchbox"), { target: { value: "número 7" } });
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Resultados para “número 7”"));
    expect(new URLSearchParams(window.location.search).get("q")).toBe("número 7");
  });

  it("filters by year and state from the pickers, and keeps both in the address bar", async () => {
    window.history.replaceState(null, "", "/busca");
    render(<Results {...props} />);
    const year = screen.getByRole("combobox", { name: "Ano" });
    expect(within(year).getByRole("option", { name: "2019 (10)" })).toBeInTheDocument();
    fireEvent.change(year, { target: { value: "2019" } });
    await waitFor(() => expect(screen.getByText(/10 leis, das mais novas/)).toBeInTheDocument());
    expect(new URLSearchParams(window.location.search).get("ano")).toBe("2019");
    await waitFor(() => expect(cards().map((a) => a.getAttribute("href"))).toContain("/lei/lei-10"));

    fireEvent.change(screen.getByRole("combobox", { name: "Estado" }), { target: { value: "RJ" } });
    await waitFor(() => expect(screen.getByText(/Nenhuma lei com esses filtros/)).toBeInTheDocument());
    expect(window.location.search).toBe("?uf=RJ&ano=2019");

    fireEvent.change(screen.getByRole("combobox", { name: "Ano" }), { target: { value: "" } });
    expect(window.location.search).toBe("?uf=RJ");
  });
});
