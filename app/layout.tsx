import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Recursive } from "next/font/google";
import { DESCRIPTION, NAME, SITE_URL, TAGLINE } from "@/lib/site";
import "./globals.css";

const recursive = Recursive({ subsets: ["latin"], axes: ["MONO", "CASL", "slnt"], variable: "--font-recursive" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${NAME}: ${TAGLINE}`, template: `%s | ${NAME}` },
  description: DESCRIPTION,
  applicationName: NAME,
  keywords: ["ASCII art", "image to ASCII", "ASCII art generator", "photo to text art", "SVG ASCII art", "GitHub profile art"],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: NAME,
    title: `${NAME}: ${TAGLINE}`,
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "A lump of charcoal drawn in ASCII characters" }],
  },
  twitter: { card: "summary_large_image", title: `${NAME}: ${TAGLINE}`, description: DESCRIPTION, images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#d9d5cb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={recursive.variable}>
      <body>
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <filter id="char" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" result="d" />
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 1.7" result="tooth" />
            <feComposite in="d" in2="tooth" operator="in" />
          </filter>
          <filter id="sumi" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="3" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4" result="d" />
            <feTurbulence type="fractalNoise" baseFrequency="0.09 0.8" numOctaves="2" seed="9" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 1.75" result="dry" />
            <feComposite in="d" in2="dry" operator="in" />
          </filter>
          <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="8" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="26" result="d" />
            <feGaussianBlur in="d" stdDeviation="1.4" result="b" />
            <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="3" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.3 1.45" result="grain" />
            <feComposite in="b" in2="grain" operator="in" />
          </filter>
        </svg>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
