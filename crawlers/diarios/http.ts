/**
 * Small HTTP client: polite user agent, timeout, redirects, retries with backoff on network errors and 429/5xx.
 *
 * Uses node:https (HTTP/1.1) rather than fetch: in.gov.br resets HTTP/2 streams from CI runners
 * (NGHTTP2_PROTOCOL_ERROR), and Node's fetch negotiates HTTP/2.
 */
import https from "node:https";

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
      const res = await get(url, timeoutMs);
      if (res.status >= 200 && res.status < 300) return res.body;
      lastError = new HttpError(res.status, url);
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function get(url: string, timeoutMs: number, redirects = 5): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(get(new URL(res.headers.location, url).toString(), timeoutMs, redirects - 1));
          return;
        }
        res.setEncoding("utf8");
        let body = "";
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status, body }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout after ${timeoutMs} ms`)));
    req.on("error", reject);
  });
}

export async function fetchJson<T>(url: string, opts?: { retries?: number; timeoutMs?: number }): Promise<T> {
  return JSON.parse(await fetchText(url, opts)) as T;
}

/** "fetch failed" hides the real reason (DNS, refused, timeout, TLS) in `cause`; surface it in logs. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  const code = (err as { code?: string }).code;
  if (cause) return `${err.message} (${cause.code ?? ""} ${cause.message ?? ""})`.replace(/\s+\)/, ")");
  return code ? `${code}: ${err.message}` : err.message;
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
