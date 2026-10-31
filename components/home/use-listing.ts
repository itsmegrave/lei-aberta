"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMPTY_FILTERS, isFiltered, overview as computeOverview, type Filters, type Overview, type Row } from "@/lib/catalog";
import { decodeIndex, PAGE_SIZE, pageCount, pageFile, pageOfPos, readUrlState, writeUrlState, type IndexFile } from "@/lib/listing";
import type { Policy } from "@/lib/types";

// Fetched files are cached for the session: pages and the index never change between builds.
const cache = new Map<string, Promise<unknown>>();
function getJson<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    const p = fetch(`/dados/${file}`).then((r) => {
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(file)); // let a later attempt retry
    cache.set(file, p);
  }
  return cache.get(file) as Promise<T>;
}
const loadIndex = () => getJson<IndexFile>("indice.json").then(decodeIndex);
const loadPage = (n: number) => getJson<Policy[]>(pageFile(n));

/**
 * Filters, page and data for the home page. Unfiltered, it pages through /dados/pagina-<n>.json.
 * Once anything is filtered it loads the compact index, filters in the browser, and fetches
 * only the page files that hold the cards on screen. Filters and page live in the URL.
 */
export function useListing({ firstPage, overview: initial, pages: allPages, lastYear }: { firstPage: Policy[]; overview: Overview; pages: number; lastYear: number }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cards, setCards] = useState<Policy[]>(firstPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const filtered = isFiltered(filters);

  // Start from the address bar, and follow back/forward.
  useEffect(() => {
    const sync = () => {
      const s = readUrlState(window.location.search);
      setFilters(s.filters);
      setPage(s.page);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // The index is only needed once someone filters or searches.
  useEffect(() => {
    if (!filtered || rows) return;
    let live = true;
    loadIndex().then(
      (r) => live && setRows(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [filtered, rows]);

  const result = useMemo(() => (filtered && rows ? computeOverview(rows, filters, lastYear) : null), [filtered, rows, filters, lastYear]);
  const ov = filtered ? (result?.overview ?? null) : initial;
  const pages = filtered ? pageCount(result?.overview.total ?? 0) : allPages;
  const current = Math.min(page, pages);

  // Cards on screen: one page file unfiltered, or the page files that hold the matches on this page.
  const want = useMemo(() => (result ? result.matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((r) => r.pos) : null), [result, current]);
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    let job: Promise<Policy[]>;
    if (!filtered) {
      if (current === 1) {
        setCards(firstPage);
        setLoading(false);
        return;
      }
      job = loadPage(current);
    } else if (want) {
      const files = [...new Set(want.map(pageOfPos))];
      job = Promise.all(files.map(async (n) => [n, await loadPage(n)] as const)).then((loaded) => {
        const byFile = new Map(loaded);
        return want.map((pos) => byFile.get(pageOfPos(pos))![pos % PAGE_SIZE]);
      });
    } else {
      setLoading(true); // waiting for the index
      return;
    }
    setLoading(true);
    job.then(
      (c) => {
        if (id !== seq.current) return;
        setCards(c);
        setLoading(false);
        setFailed(false);
      },
      () => id === seq.current && (setLoading(false), setFailed(true)),
    );
  }, [filtered, current, want, firstPage]);

  const commit = useCallback((f: Filters, p: number, push: boolean) => {
    setFilters(f);
    setPage(p);
    const url = `${window.location.pathname}${writeUrlState(f, p)}${window.location.hash}`;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  return {
    filters,
    filtered,
    page: current,
    pages,
    cards,
    overview: ov,
    loading,
    failed,
    /** Change filters; goes back to page 1. */
    setFilters: (next: Filters | ((f: Filters) => Filters)) => commit(typeof next === "function" ? next(filters) : next, 1, false),
    goTo: (p: number) => commit(filters, Math.max(1, Math.min(p, pages)), true),
  };
}
