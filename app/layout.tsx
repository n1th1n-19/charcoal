import type { Metadata } from "next";
import { Recursive } from "next/font/google";
import "./globals.css";

const recursive = Recursive({ subsets: ["latin"], axes: ["MONO", "CASL"], variable: "--font-recursive" });

export const metadata: Metadata = {
  title: "Charcoal",
  description: "Turn an image into detailed ASCII art. Everything runs in your browser.",
};

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
        </svg>
        {children}
      </body>
    </html>
  );
}
