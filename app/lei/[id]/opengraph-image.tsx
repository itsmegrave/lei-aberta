import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { authorKeys, NO_PARTY, UNKNOWN_PARTY } from "@/lib/catalog";
import { loadCatalog } from "@/lib/data";
import { partyScore, spectrumColor } from "@/lib/party-spectrum";
import { area, lawLabel, LEVELS } from "@/lib/vocab";

// Share image for WhatsApp, X, Instagram and friends. Rendered on first request, then cached.
export const alt = "Resumo da lei no Lei Aberta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  return [];
}

// Light-theme topic tints from app/globals.css (Satori cannot read CSS variables).
const TINT: Record<string, [string, string]> = {
  saude: ["#ffe3ea", "#c2255c"], edu: ["#e3edff", "#2457c5"], amb: ["#dcf6e8", "#127a4a"],
  ass: ["#fff0d6", "#a85d00"], dir: ["#efe4ff", "#6b3fd1"], tec: ["#dcf4fb", "#0b7590"],
  gov: ["#eceaf3", "#4a4766"], cid: ["#ffe8dc", "#b8481a"], san: ["#dff1ff", "#1468a8"],
  seg: ["#e8ecf2", "#3c4a63"], eco: ["#f2f6d8", "#5d6b00"],
};
// Author kinds that are institutions (no party), as in lib/catalog.ts.
const INSTITUTION_KINDS = new Set(["executive", "committee", "judiciary", "prosecution", "other"]);
const LEVEL_COLOR: Record<string, string> = { federal: "#2a78d6", estadual: "#eb6834", municipal: "#1baf7a" };
const INK = "#17142e";
const MUTED = "#5d5980";

const root = process.cwd();
const font = (pkg: string, file: string) => readFile(path.join(root, "node_modules/@fontsource", pkg, "files", file));

/** Who proposed or signed: a name, and below it the party with its left-right color dot (when it applies). */
function Who({ label, name, party }: { label: string; name: string; party?: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 800 }}>{name.length > 26 ? `${name.slice(0, 25).trimEnd()}…` : name}</div>
      {party !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700, color: MUTED }}>
          {party && <div style={{ width: 14, height: 14, borderRadius: 7, background: spectrumColor(partyScore(party), "light") }} />}
          {party ?? NO_PARTY}
        </div>
      )}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const { policies } = await loadCatalog();
  const p = policies.find((x) => x.id === id);
  if (!p) notFound();
  const a = area(p.areas[0]);
  const [bg, fg] = TINT[a.tint] ?? TINT.gov;
  const level = LEVELS.find((l) => l.key === p.level)!;
  const emoji = await readFile(path.join(root, "assets/og-emoji", `${a.emoji}.png`));
  // First author: a lawmaker with their party at authorship, or an institution such as "Poder Executivo".
  // The executive's party is a separate field and is shown separately.
  const first = p.authors[0];
  const lawmaker = first && !INSTITUTION_KINDS.has(first.kind);
  const authorName = !first ? "Não informado" : lawmaker ? first.name : authorKeys({ ...p, authors: [first] })[0];
  const title = p.title.length > 90 ? `${p.title.slice(0, 88).trimEnd()}…` : p.title;
  const summary = p.summary.length > 150 ? `${p.summary.slice(0, 148).trimEnd()}…` : p.summary;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: bg, color: INK, fontFamily: "Figtree", padding: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 700 }}>
          <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 32 }}>Lei Aberta</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ffffffb3", borderRadius: 999, padding: "6px 16px", color: MUTED }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: LEVEL_COLOR[p.level] }} />
            {`${level.label} · ${p.jurisdiction}`}
          </div>
          <div style={{ display: "flex", background: "#ffffffb3", borderRadius: 999, padding: "6px 16px", color: fg }}>{a.label}</div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 18 }}>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: title.length > 50 ? 60 : 72, lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</div>
            <div style={{ display: "flex", fontSize: 30, lineHeight: 1.3, color: MUTED }}>{summary}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={`data:image/png;base64,${emoji.toString("base64")}`} width={200} height={200} style={{ transform: "rotate(-6deg)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 44, background: "#ffffffcc", borderRadius: 28, padding: "22px 32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: MUTED }}>{lawLabel(p, true)}</div>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 54, lineHeight: 1, color: fg }}>{p.year}</div>
          </div>
          <Who label={p.authors.length > 1 ? `Quem propôs (e mais ${p.authors.length - 1})` : "Quem propôs"} name={authorName} party={lawmaker ? (first.party ?? UNKNOWN_PARTY) : undefined} />
          {p.executive ? <Who label="Quem sancionou" name={p.executive.name} party={p.executive.party} /> : <Who label="Quem sancionou" name="Não informado" />}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Figtree", data: await font("figtree", "figtree-latin-700-normal.woff"), weight: 700 },
        { name: "Figtree", data: await font("figtree", "figtree-latin-800-normal.woff"), weight: 800 },
        { name: "Bricolage", data: await font("bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff"), weight: 800 },
      ],
    },
  );
}
