import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { News, NEWS_API } from "./news";

afterEach(() => vi.unstubAllGlobals());

const stub = (res: Partial<Response> | Error) =>
  vi.stubGlobal("fetch", vi.fn(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res as Response))));

describe("News", () => {
  it("lists headlines with outlet and a link to the original story", async () => {
    stub({
      ok: true,
      json: async () => ({
        items: [
          { title: "Senado aprova PEC", url: "https://www12.senado.leg.br/n/1", outlet: "Agência Senado", summary: "A proposta segue para a Câmara.", image: "https://www12.senado.leg.br/i.jpg", date: new Date().toISOString() },
          { title: "Câmara vota reforma", url: "https://folha.com/n/2", outlet: "Folha de S.Paulo", paywall: true, date: new Date().toISOString() },
        ],
        outlets: ["Agência Senado", "g1"],
      }),
    });
    render(<News />);
    const link = await screen.findByRole("link", { name: /Senado aprova PEC/ });
    expect(link).toHaveAttribute("href", "https://www12.senado.leg.br/n/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getAllByText("Agência Senado").length).toBeGreaterThan(0);
    expect(screen.getByText(/feeds públicos de Agência Senado, g1/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(NEWS_API);
    expect(screen.getByText("A proposta segue para a Câmara.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /deslize/ }).className).toContain("snap-x");
    expect(document.querySelector('img[src="https://www12.senado.leg.br/i.jpg"]')).not.toBeNull();
    // Only the paywalled outlet gets the warning.
    expect(screen.getAllByText("pode pedir assinatura")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Câmara vota reforma/ })).toHaveAttribute("href", "https://folha.com/n/2");
  });

  it("says so when the news can't load", async () => {
    stub(new Error("offline"));
    render(<News />);
    expect(await screen.findByText(/Não conseguimos carregar as notícias/)).toBeInTheDocument();
  });

  it("shows a placeholder while loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<News />);
    expect(screen.getByLabelText("Carregando notícias")).toBeInTheDocument();
  });
});
