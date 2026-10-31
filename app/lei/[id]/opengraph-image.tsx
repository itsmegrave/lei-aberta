import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { authorKeys, NO_PARTY, UNKNOWN_PARTY } from "@/lib/catalog";
import { findPolicy } from "@/lib/data";
import { partyScore, SPECTRUM_STOPS, spectrumColor } from "@/lib/party-spectrum";
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
// Green and yellow base (Brazilian flag tones), kept dark enough for white text.
const GREEN = "#00733a";
const GREEN_INK = "#005a2d";
const YELLOW = "#ffd400";
const SPECTRUM = SPECTRUM_STOPS.light;
const INK = "#17142e";
const MUTED = "#4d4a2e";

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
  const p = await findPolicy(id);
  if (!p) notFound();
  const a = area(p.areas[0]);
  const [bg, fg] = TINT[a.tint] ?? TINT.gov;
  const level = LEVELS.find((l) => l.key === p.level)!;
  const emoji = await readFile(path.join(root, "assets/og-emoji", `${a.emoji}.png`));
  // The topic's icon: large beside the title and small in the topic chip.
  const emojiData = `data:image/png;base64,${emoji.toString("base64")}`;
  // First author: a lawmaker with their party at authorship, or an institution such as "Poder Executivo".
  // The executive's party is a separate field and is shown separately.
  const first = p.authors[0];
  const lawmaker = first && !INSTITUTION_KINDS.has(first.kind);
  const authorName = !first ? "Não informado" : lawmaker ? first.name : authorKeys({ ...p, authors: [first] })[0];
  const title = p.title.length > 90 ? `${p.title.slice(0, 88).trimEnd()}…` : p.title;
  const summary = p.summary.length > 150 ? `${p.summary.slice(0, 148).trimEnd()}…` : p.summary;

  // Bottom bar: the left-right scale from the home page chart, with a marker at the proposing party's position.
  const score = lawmaker ? partyScore(first.party) : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: GREEN, color: "#ffffff", fontFamily: "Figtree", padding: "44px 56px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 700 }}>
          <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 34, color: YELLOW }}>Lei Aberta</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ffffff", borderRadius: 999, padding: "6px 16px", color: INK }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: LEVEL_COLOR[p.level] }} />
            {`${level.label} · ${p.jurisdiction}`}
          </div>
          {p.areas[0] && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: bg, borderRadius: 999, padding: "4px 16px 4px 8px", color: fg }}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={emojiData} width={32} height={32} />
              {a.label}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: title.length > 50 ? 58 : 70, lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</div>
            <div style={{ display: "flex", fontSize: 29, lineHeight: 1.3, color: "#e3f5e9" }}>{summary}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={emojiData} width={190} height={190} style={{ transform: "rotate(-6deg)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 44, background: YELLOW, color: INK, borderRadius: 28, padding: "20px 32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: MUTED }}>{lawLabel(p, true)}</div>
            <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 54, lineHeight: 1, color: GREEN_INK }}>{p.year}</div>
          </div>
          <Who label={p.authors.length > 1 ? `Quem propôs (e mais ${p.authors.length - 1})` : "Quem propôs"} name={authorName} party={lawmaker ? (first.party ?? UNKNOWN_PARTY) : undefined} />
          {p.executive ? <Who label="Quem sancionou" name={p.executive.name} party={p.executive.party} /> : <Who label="Quem sancionou" name="Não informado" />}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, fontSize: 18, fontWeight: 700, color: "#e3f5e9" }}>
          <div style={{ display: "flex" }}>esquerda</div>
          <div style={{ display: "flex", flex: 1, position: "relative", height: 16, borderRadius: 8, background: score == null ? SPECTRUM.none : `linear-gradient(90deg, ${SPECTRUM.left}, ${SPECTRUM.mid}, ${SPECTRUM.right})` }}>
            {score == null && (
              <div style={{ position: "absolute", left: 0, right: 0, top: -2, display: "flex", justifyContent: "center", fontSize: 15, color: INK }}>
                {lawmaker ? "partido sem posição na escala" : "quem propôs não tem partido"}
              </div>
            )}
            {score != null && (
              <div style={{ position: "absolute", left: `${score * 10}%`, top: -7, width: 30, height: 30, marginLeft: -15, borderRadius: 15, background: spectrumColor(score, "light"), border: "5px solid #ffffff" }} />
            )}
          </div>
          <div style={{ display: "flex" }}>direita</div>
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
