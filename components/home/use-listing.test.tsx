import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS, overview, toRow } from "@/lib/catalog";
import { encodeIndex, PAGE_SIZE, pageFile, toCard } from "@/lib/listing";
import type { Policy } from "@/lib/types";
import { law } from "@/test/fixtures";

// 60 laws, newest first: three page files. Every third is about education and by a PT deputy.
const catalog: Policy[] = Array.from({ length: 60 }, (_, i) =>
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

const fetchMock = vi.fn(async (url: string) => {
  const body = files[url.replace("/dados/", "")];
  return body ? new Response(JSON.stringify(body)) : new Response("not found", { status: 404 });
});

const props = {
  firstPage: catalog.slice(0, PAGE_SIZE).map(toCard),
  overview: overview(rows, EMPTY_FILTERS, 2020).overview,
  pages: 3,
  lastYear: 2020,
};

// The hook keeps a module-level cache of fetched files, so each test gets a fresh copy.
async function setup(search = "") {
  window.history.replaceState(null, "", `/${search}`);
  vi.resetModules();
  const { useListing } = await import("./use-listing");
  return renderHook(() => useListing(props));
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const fetched = () => fetchMock.mock.calls.map(([u]) => u);

describe("useListing", () => {
  it("unfiltered page 1 renders from props without any fetch", async () => {
    const { result } = await setup();
    expect(result.current.page).toBe(1);
    expect(result.current.pages).toBe(3);
    expect(result.current.cards).toBe(props.firstPage);
    expect(result.current.overview).toBe(props.overview);
    expect(result.current.filtered).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("going to a page loads only that page file and pushes it to the URL", async () => {
    const { result } = await setup();
    act(() => result.current.goTo(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.page).toBe(2);
    expect(result.current.cards[0].id).toBe("lei-24");
    expect(fetched()).toEqual(["/dados/pagina-2.json"]);
    expect(window.location.search).toBe("?pagina=2");
  });

  it("goTo clamps to the last page", async () => {
    const { result } = await setup();
    act(() => result.current.goTo(99));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.page).toBe(3);
  });

  it("starts from filters in the address bar and loads the index", async () => {
    const { result } = await setup("?tema=educacao");
    await waitFor(() => expect(result.current.overview).not.toBeNull());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.filters.area).toBe("educacao");
    expect(result.current.overview!.total).toBe(20);
    expect(result.current.pages).toBe(1);
    expect(result.current.cards).toHaveLength(20);
    expect(result.current.cards.every((c) => c.areas.includes("educacao"))).toBe(true);
    expect(fetched()).toContain("/dados/indice.json");
  });

  it("filtering resets to page 1 and writes the filter in Portuguese", async () => {
    const { result } = await setup("?pagina=3");
    expect(result.current.page).toBe(3);
    act(() => result.current.setFilters((f) => ({ ...f, author: "PT" })));
    await waitFor(() => expect(result.current.overview?.total).toBe(20));
    expect(result.current.page).toBe(1);
    expect(window.location.search).toBe("?autor=PT");
  });

  it("clearing filters goes back to the shipped first page", async () => {
    const { result } = await setup("?q=numero+5");
    await waitFor(() => expect(result.current.overview).not.toBeNull());
    act(() => result.current.setFilters(EMPTY_FILTERS));
    expect(result.current.filtered).toBe(false);
    await waitFor(() => expect(result.current.cards).toBe(props.firstPage));
    expect(window.location.search).toBe("");
  });

  it("follows back and forward", async () => {
    const { result } = await setup();
    act(() => {
      window.history.pushState(null, "", "/?nivel=estadual");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.filters.level).toBe("estadual");
  });

  it("reports a failed load", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("oops", { status: 500 }));
    const { result } = await setup();
    act(() => result.current.goTo(2));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.loading).toBe(false);
  });
});
