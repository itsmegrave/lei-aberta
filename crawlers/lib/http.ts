// Small HTTP helper for crawlers: JSON fetch with retries, backoff and a global concurrency cap.

const USER_AGENT = "LeiAberta/0.1 (+https://github.com/itsmegrave/lei-aberta)";

export type FetchJson = (url: string) => Promise<unknown>;

let active = 0;
const queue: (() => void)[] = [];
async function slot<T>(limit: number, fn: () => Promise<T>): Promise<T> {
  if (active >= limit) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
    this.url = url;
  }
}

export function makeFetchJson({ concurrency = 4, retries = 4, timeoutMs = 60_000 } = {}): FetchJson {
  return (url) =>
    slot(concurrency, async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(url, {
            headers: { Accept: "application/json", "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(timeoutMs),
          });
          // 404 is a real answer ("no such record"), not a transient failure.
          if (res.status === 404) return null;
          if (!res.ok) throw new HttpError(res.status, url);
          const text = await res.text();
          return text.trim() ? JSON.parse(text) : null;
        } catch (err) {
          const status = err instanceof HttpError ? err.status : 0;
          if (attempt >= retries || (status >= 400 && status < 500 && status !== 429)) throw err;
          await sleep(2000 * 2 ** attempt);
        }
      }
    });
}

/** Many Senado endpoints return a single object where a list is expected; normalize to an array. */
export const arr = <T>(v: T | T[] | null | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
