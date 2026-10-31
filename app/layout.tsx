import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SITE_URL } from "@/lib/share";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/seo";

// Google Search Console ownership token for lei-aberta.vercel.app (HTML tag method).
const GOOGLE_SITE_VERIFICATION = "7_N2pMysZaz14gWV-xwvvKm3NdHFsHmOUey_XAR3-X4";

// Site-wide search and share metadata (pt-BR). Pages override title, description and canonical.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "pt_BR", title: SITE_TITLE, description: SITE_DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false, email: false, address: false },
  // Search Console / Bing ownership tokens. These are public by design (they ship in every page's HTML).
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined,
  },
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
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <Providers>{children}</Providers>
        {/* Page views, including visits to short links (/l/*). Enable Web Analytics in the Vercel project. */}
        <Analytics />
      </body>
    </html>
  );
}
