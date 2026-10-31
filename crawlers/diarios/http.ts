/**
 * Small HTTP client: polite user agent, timeout, redirects, retries with backoff on network errors and 429/5xx.
 *
 * Uses node:https (HTTP/1.1) rather than fetch: in.gov.br resets HTTP/2 streams from CI runners
 * (NGHTTP2_PROTOCOL_ERROR), and Node's fetch negotiates HTTP/2.
 */
import https from "node:https";

export const USER_AGENT = "LeiAbertaBot/0.1 (+https://github.com/itsmegrave/lei-aberta)";
/**
 * Fallback user agent. in.gov.br drops requests whose user agent is not a browser's (seen from
 * GitHub runners, Oct 2026). Every host is first asked with our own user agent; only when that
 * request is refused (connection dropped, 403 or 429) do we retry with this one, and keep using it
 * for that host for the rest of the run. Requests stay few and slow (low concurrency).
 */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
/** Hosts that refused our own user agent during this run. */
const browserHosts = new Set<string>();

export function userAgentFor(url: string): string {
  return browserHosts.has(new URL(url).hostname) ? BROWSER_USER_AGENT : USER_AGENT;
}

/** True when a failure looks like bot blocking rather than a missing page or a down server. */
export function looksBlocked(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 403 || err.status === 429;
  const code = (err as { code?: string })?.code ?? "";
  return ["ECONNRESET", "EPIPE", "ERR_HTTP2_STREAM_ERROR", "ECONNABORTED"].includes(code) || /socket hang up|empty reply/i.test(String(err));
}

/** Switches `url`'s host to the browser user agent. Returns false if it already uses it. */
function fallBackToBrowser(url: string, log: (msg: string) => void): boolean {
  const host = new URL(url).hostname;
  if (browserHosts.has(host)) return false;
  browserHosts.add(host);
  log(`${host} refused our user agent; retrying as a browser for the rest of this run.`);
  return true;
}

export class HttpError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
    this.url = url;
  }
}

export async function fetchText(
  url: string,
  { retries = 3, timeoutMs = 30_000, log = console.log as (msg: string) => void } = {},
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt);
    try {
      const res = await get(url, timeoutMs);
      if (res.status >= 200 && res.status < 300) return res.body;
      lastError = new HttpError(res.status, url);
    } catch (err) {
      lastError = err;
    }
    // Refused as a bot: retry right away as a browser (once per host).
    if (looksBlocked(lastError) && fallBackToBrowser(url, log)) {
      attempt--;
      continue;
    }
    if (lastError instanceof HttpError && lastError.status !== 429 && lastError.status < 500) break;
  }
  throw lastError;
}

function get(url: string, timeoutMs: number, redirects = 5): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { "user-agent": userAgentFor(url), accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" },
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
