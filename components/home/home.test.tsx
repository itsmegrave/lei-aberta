import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS, overview, toRow } from "@/lib/catalog";
import { law } from "@/test/fixtures";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { Home } = await import("./home");

const rows = [law({ id: "a", areas: ["saude"] }), law({ id: "b", areas: ["educacao"], year: 2000 })].map(toRow);
const props = { overview: overview(rows, EMPTY_FILTERS, 2020).overview, ticker: [], sample: false, sources: [] };

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(() => window.history.replaceState(null, "", "/"));

describe("Home", () => {
  it("shows the numbers but no list of laws", () => {
    render(<Home {...props} />);
    expect(screen.getByText(/leis explicadas/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "As leis" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/lei/"))).toHaveLength(0);
  });

  it("sends topics and the full list to the search page", () => {
    render(<Home {...props} />);
    expect(screen.getByRole("link", { name: /Saúde/ })).toHaveAttribute("href", "/busca?tema=saude");
    expect(screen.getByRole("link", { name: /Ver todas as leis/ })).toHaveAttribute("href", "/busca");
    expect(screen.getByRole("link", { name: "internet" })).toHaveAttribute("href", "/busca?q=internet");
  });

  it("opens the search page with the words typed", () => {
    render(<Home {...props} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar leis" }), { target: { value: " escola " } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(router.push).toHaveBeenCalledWith("/busca?q=escola");
  });

  it("opens the search page for a level", () => {
    render(<Home {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Estadual/ }));
    expect(router.push).toHaveBeenCalledWith("/busca?nivel=estadual");
  });

  it("moves old filtered home links to the search page", () => {
    window.history.replaceState(null, "", "/?tema=saude&pagina=2");
    render(<Home {...props} />);
    expect(router.replace).toHaveBeenCalledWith("/busca?tema=saude&pagina=2");
  });

  it("stays put without filters", () => {
    render(<Home {...props} />);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
