import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Home-screen icon for iOS: the scroll emoji on the site's light background.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default async function AppleIcon() {
  const png = await readFile(path.join(process.cwd(), "assets/og-emoji/scroll.png"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f6fd" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={`data:image/png;base64,${png.toString("base64")}`} width={140} height={140} />
      </div>
    ),
    size,
  );
}
