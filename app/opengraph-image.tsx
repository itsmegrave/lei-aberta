import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Share image for the home page. Law pages have their own (app/lei/[id]/opengraph-image.tsx).
export const alt = "Lei Aberta: as leis do Brasil explicadas em uma frase";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

const INK = "#17142e";
const MUTED = "#5d5980";
const root = process.cwd();
const font = (pkg: string, file: string) => readFile(path.join(root, "node_modules/@fontsource", pkg, "files", file));
const emoji = (name: string) => readFile(path.join(root, "assets/og-emoji", `${name}.png`)).then((b) => `data:image/png;base64,${b.toString("base64")}`);

export default async function Image() {
  const [scroll, ...topics] = await Promise.all(["scroll", "stethoscope", "books", "deciduous-tree", "mobile-phone"].map(emoji));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f7f6fd", color: INK, fontFamily: "Figtree", padding: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={scroll} width={72} height={72} style={{ transform: "rotate(-6deg)" }} />
          <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 44 }}>Lei Aberta</div>
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 22 }}>
          <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 96, lineHeight: 1, letterSpacing: -2.5 }}>Que lei mudou a sua vida?</div>
          <div style={{ display: "flex", fontSize: 34, lineHeight: 1.3, color: MUTED, maxWidth: 900 }}>
            Cada lei do Brasil em uma frase, com quem propôs, quem sancionou e o link para o texto oficial.
          </div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {topics.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img key={src.slice(-24)} src={src} width={64} height={64} />
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Figtree", data: await font("figtree", "figtree-latin-700-normal.woff"), weight: 700 },
        { name: "Bricolage", data: await font("bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff"), weight: 800 },
      ],
    },
  );
}
