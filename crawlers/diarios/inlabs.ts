/**
 * Diário Oficial da União through INLABS (inlabs.in.gov.br), Imprensa Nacional's service for
 * automated downloads. It needs a free account; the crawler reads INLABS_EMAIL and INLABS_PASSWORD.
 *
 * Each day and section is a ZIP of XML files, one per act:
 *   <article pubName="DO1" artType="Lei" pubDate="17/09/2024" numberPage="1" pdfPage="http://pesquisa.in.gov.br/...">
 *     <body><Identifica>LEI Nº 14.973, DE 16 DE SETEMBRO DE 2024</Identifica><Ementa>Dispõe sobre…</Ementa>…
 * The public site (in.gov.br) drops requests that do not come from a browser, so this is the
 * route that keeps working from CI.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Policy } from "../../lib/types.ts";
import { type DouResult, isCatalogued, toRecord } from "./dou.ts";
import { describeError, USER_AGENT } from "./http.ts";
import { clean } from "./text.ts";

const BASE = "https://inlabs.in.gov.br";
/** INLABS names: regular Seção 1 and its extra edition. */
export const INLABS_SECTIONS = [
  { inlabs: "DO1", section: "do1" },
  { inlabs: "DO1E", section: "do1e" },
] as const;

export interface InlabsArticle {
  pubDate: string;
  numberPage?: string;
  pdfPage?: string;
  identifica: string;
  ementa: string;
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const element = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? clean(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")) : "";
};

export function parseArticle(xml: string): InlabsArticle | null {
  const open = xml.match(/<article\b[^>]*>/i)?.[0];
  if (!open) return null;
  return {
    pubDate: attr(open, "pubDate") ?? "",
    numberPage: attr(open, "numberPage"),
    pdfPage: attr(open, "pdfPage"),
    identifica: element(xml, "Identifica"),
    ementa: element(xml, "Ementa"),
  };
}

/** The page viewer link on pesquisa.in.gov.br, forced to https. */
export function viewerUrl(a: InlabsArticle): string | null {
  return a.pdfPage ? a.pdfPage.replace(/^http:/, "https:").replace(/&amp;/g, "&") : null;
}

export function articleToRecord(a: InlabsArticle, section: string, day: string): Policy | null {
  const header = isCatalogued({ urlTitle: "", title: a.identifica });
  const url = viewerUrl(a);
  if (!header || !url) return null;
  const m = a.pubDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const publishedOn = m ? `${m[3]}-${m[2]}-${m[1]}` : day;
  return toRecord({ urlTitle: "", numberPage: a.numberPage }, header, a.ementa, publishedOn, section, url);
}

function request(url: string, opts: { method?: string; body?: string; cookie?: string }): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: opts.method ?? "GET",
        timeout: 120_000,
        headers: {
          "user-agent": USER_AGENT,
          ...(opts.body ? { "content-type": "application/x-www-form-urlencoded", "content-length": Buffer.byteLength(opts.body) } : {}),
          ...(opts.cookie ? { cookie: opts.cookie } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await request(`${BASE}/logar.php`, { method: "POST", body: new URLSearchParams({ email, password }).toString() });
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const session = cookies.map((c) => c.split(";")[0]).find((c) => c.startsWith("inlabs_session_cookie="));
  if (!session) throw new Error(`INLABS login failed (HTTP ${res.status}); check INLABS_EMAIL and INLABS_PASSWORD`);
  return session;
}

/** Unzips with the system `unzip` (present on GitHub runners) and returns the XML files' text. */
async function unzipXml(zip: Buffer): Promise<string[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "inlabs-"));
  try {
    await writeFile(path.join(dir, "day.zip"), zip);
    await promisify(execFile)("unzip", ["-qq", "-o", "day.zip", "-d", "x"], { cwd: dir });
    const files = (await readdir(path.join(dir, "x"), { recursive: true })).filter((f) => f.toLowerCase().endsWith(".xml"));
    return Promise.all(files.map((f) => readFile(path.join(dir, "x", f), "utf8")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function crawlInlabs(days: string[], email: string, password: string, { log = console.log } = {}): Promise<DouResult> {
  const errors: string[] = [];
  const records: Policy[] = [];
  let cookie: string;
  try {
    cookie = await login(email, password);
  } catch (err) {
    return { records, errors: [describeError(err)] };
  }
  for (const day of days) {
    for (const { inlabs, section } of INLABS_SECTIONS) {
      const file = `${day}-${inlabs}.zip`;
      try {
        const res = await request(`${BASE}/index.php?p=${day}&dl=${file}`, { cookie: `${cookie}; origem=736372697074` });
        // No file for that day (weekends, no extra edition) comes back as a non-ZIP page.
        if (res.status !== 200 || res.body.subarray(0, 2).toString() !== "PK") {
          if (inlabs === "DO1" && new Date(`${day}T12:00:00Z`).getUTCDay() % 6 !== 0) errors.push(`${file}: no ZIP (HTTP ${res.status})`);
          continue;
        }
        for (const xml of await unzipXml(res.body)) {
          const a = parseArticle(xml);
          const r = a && articleToRecord(a, section, day);
          if (r) records.push(r);
        }
      } catch (err) {
        errors.push(`${file}: ${describeError(err)}`);
      }
    }
  }
  log(`DOU (INLABS): ${records.length} catalogued acts in ${days.length} day(s)`);
  return { records, errors };
}
