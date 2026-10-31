/**
 * Polite HTTP for the state crawlers: identifying user agent, timeout, retries with backoff on network errors
 * and 429/5xx, a minimum gap between requests to the same host, and a robots.txt check per host.
 */
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

export class RobotsDisallowed extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimum gap between two requests to the same host. Small public servers; be gentle. */
export let HOST_GAP_MS = 300;
export function setHostGap(ms: number) {
  HOST_GAP_MS = ms;
}
const nextSlot = new Map<string, number>();

async function waitTurn(host: string) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + HOST_GAP_MS);
  if (at > now) await sleep(at - now);
}

/**
 * Parses robots.txt and returns the Disallow/Allow rules that apply to our bot
 * (a group naming "LeiAbertaBot", else the "*" group).
 */
export function robotsRules(txt: string): { allow: string[]; disallow: string[] } {
  type Group = { agents: string[]; allow: string[]; disallow: string[] };
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], allow: [], disallow: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "disallow" && val) cur.disallow.push(val);
    if (key === "allow" && val) cur.allow.push(val);
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== "*" && USER_AGENT.toLowerCase().includes(a)));
  const star = groups.find((g) => g.agents.includes("*"));
  const g = mine ?? star;
  return { allow: g?.allow ?? [], disallow: g?.disallow ?? [] };
}

/** Longest-match wins, Allow wins ties (Google's reading of the robots.txt draft). Supports * and $. */
export function robotsAllows(rules: { allow: string[]; disallow: string[] }, pathAndQuery: string): boolean {
  const match = (pattern: string) => {
    // Escape regex specials, keep "*" as a wildcard and a trailing "$" as an end anchor.
    const body = pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\$(?!$)/g, "\\$").replace(/\*/g, ".*");
    const re = new RegExp("^" + body);
    return re.test(pathAndQuery) ? pattern.length : -1;
  };
  const a = Math.max(-1, ...rules.allow.map(match));
  const d = Math.max(-1, ...rules.disallow.map(match));
  return d < 0 || a >= d;
}

const robotsCache = new Map<string, Promise<{ allow: string[]; disallow: string[] }>>();

async function checkRobots(url: string) {
  const u = new URL(url);
  let rules = robotsCache.get(u.origin);
  if (!rules) {
    rules = (async () => {
      try {
        await waitTurn(u.host);
        const res = await fetch(`${u.origin}/robots.txt`, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
        // No robots.txt (4xx) means everything is allowed; a 5xx we also read as "no rules" rather than block a run.
        return res.ok ? robotsRules(await res.text()) : { allow: [], disallow: [] };
      } catch {
        return { allow: [], disallow: [] };
      }
    })();
    robotsCache.set(u.origin, rules);
  }
  if (!robotsAllows(await rules, u.pathname + u.search)) throw new RobotsDisallowed(url);
}

export interface FetchOpts {
  retries?: number;
  timeoutMs?: number;
  accept?: string;
}

export async function fetchResponse(url: string, { retries = 3, timeoutMs = 60_000, accept = "application/json" }: FetchOpts = {}): Promise<Response> {
  await checkRobots(url);
  const host = new URL(url).host;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt);
    await waitTurn(host);
    try {
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      lastError = new HttpError(res.status, url);
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function fetchJson<T>(url: string, opts?: FetchOpts): Promise<T> {
  const res = await fetchResponse(url, opts);
  return (await res.json()) as T;
}

export async function fetchBuffer(url: string, opts?: FetchOpts): Promise<Buffer> {
  const res = await fetchResponse(url, { accept: "*/*", timeoutMs: 600_000, ...opts });
  return Buffer.from(await res.arrayBuffer());
}

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
