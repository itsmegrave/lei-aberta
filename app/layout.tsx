import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";
import { SITE_URL } from "@/lib/share";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lei Aberta",
  description: "Leis do Brasil desde 1988, em uma frase, com quem propôs, quem sancionou e o link para o texto oficial.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6fd" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0d1c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="lei-aberta-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
