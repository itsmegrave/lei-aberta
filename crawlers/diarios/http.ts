/** Small fetch wrapper: polite user agent, timeout, retries with backoff on network errors and 429/5xx. */

export const USER_AGENT = "LeiAbertaBot/0.1 (+https://github.com/itsmegrave/lei-aberta)";

export class HttpError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
    this.url = url;
  }
}

export async function fetchText(url: string, { retries = 3, timeoutMs = 30_000 } = {}): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.8" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.text();
      lastError = new HttpError(res.status, url);
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function fetchJson<T>(url: string, opts?: { retries?: number; timeoutMs?: number }): Promise<T> {
  return JSON.parse(await fetchText(url, opts)) as T;
}

/** "fetch failed" hides the real reason (DNS, refused, timeout, TLS) in `cause`; surface it in logs. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  return cause ? `${err.message} (${cause.code ?? ""} ${cause.message ?? ""})`.replace(/\s+\)/, ")") : err.message;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
