import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataSource } from "@/lib/sources";
import { RUNS_API, Sources } from "./sources";

afterEach(() => vi.unstubAllGlobals());

const base: DataSource = {
  id: "senado", name: "Senado Federal", publisher: "Senado Federal", url: "https://legis.senado.leg.br/dadosabertos",
  levels: ["federal"], coverage: ["Brasil"], covers: ["lei"], description: "Leis federais.", status: "active", records: 10,
  lastRun: "2026-11-02T06:30:00Z", lastSuccess: "2026-11-02T06:30:00Z", crawler: "crawlers/federal/run.ts",
};
const sources: DataSource[] = [
  base,
  { ...base, id: "assembleia-pb", name: "Assembleia da Paraíba", levels: ["estadual"], crawler: "crawlers/estadual/run.ts" },
];
const stub = (runs: unknown[]) => vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ runs }) } as Response)));
const card = (name: string) => screen.getAllByText(name)[0].closest("[class*='flex-col']") as HTMLElement;

describe("Sources", () => {
  it("shows which crawler is collecting right now, with a link to the run", async () => {
    stub([
      { crawler: "crawlers/federal/run.ts", status: "running", startedAt: new Date(Date.now() - 12 * 60_000).toISOString(), finishedAt: null, runUrl: "https://github.com/itsmegrave/lei-aberta/actions/runs/7", lastSuccessAt: null },
    ]);
    render(<Sources sources={sources} />);
    expect(await screen.findByText("Coletando agora")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(RUNS_API);
    const senado = within(card("Senado Federal"));
    expect(senado.getByText(/Começou há 12 minutos/)).toBeInTheDocument();
    expect(senado.getByRole("link", { name: /acompanhar a coleta de Senado Federal \(abre em nova aba\)/ })).toHaveAttribute(
      "href",
      "https://github.com/itsmegrave/lei-aberta/actions/runs/7",
    );
    // The state crawler is idle: its card keeps the manifest status.
    expect(within(card("Assembleia da Paraíba")).getByText("Ativa")).toBeInTheDocument();
    expect(screen.getByText(/1 coletando agora · 2 ativas/)).toBeInTheDocument();
  });

  it("shows the crawl state saved in the database over the built manifest", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ runs: [], sources: { "assembleia-pb": { status: "failing", lastRun: new Date().toISOString() } } }) } as Response)));
    render(<Sources sources={sources} />);
    expect(await within(card("Assembleia da Paraíba")).findByText("Com falha")).toBeInTheDocument();
    expect(within(card("Senado Federal")).getByText("Ativa")).toBeInTheDocument();
  });

  it("falls back to the manifests when the status can't load", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<Sources sources={sources} />);
    expect(await screen.findAllByText("Ativa")).toHaveLength(2);
    expect(screen.queryByText("Coletando agora")).toBeNull();
  });
});
