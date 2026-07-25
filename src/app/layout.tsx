import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";

import "./globals.css";

// Fredoka for display, Nunito for body — per the reference mockup.
// `display: swap` keeps text readable while fonts load on a slow phone, which is
// how most parents will reach this site.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rihana.com";

export const metadata: Metadata = {
  // Absolute base for canonical + Open Graph URLs. Set NEXT_PUBLIC_SITE_URL to
  // the real domain in production.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Rihana Montessori Academy",
    template: "%s · Rihana Montessori Academy",
  },
  description:
    "A warm, playful nursery where young children learn through play, discovery and care.",
  openGraph: {
    type: "website",
    siteName: "Rihana Montessori Academy",
    title: "Rihana Montessori Academy",
    description:
      "A warm, playful nursery in Maadi, Cairo for children aged 1–5 — learning through play, in small, caring groups.",
    images: ["/marketing/hero.jpg"],
  },
  // Overridden to `noindex` on /portal, /admin and all image routes in next.config.ts.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#FFF9EF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // `dir` is set explicitly so switching to Arabic later is a locale change,
    // not a rewrite. See src/messages/.
    <html
      lang="en"
      dir="ltr"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      {/*
        Browser extensions inject attributes onto <body> before React hydrates
        (bis_register, __processed_<uuid>__ and similar), which React reports as
        a hydration mismatch. It is the extension's markup, not ours, and there
        is nothing to fix in the app — suppressing the warning on this one
        element keeps a real mismatch elsewhere visible.
      */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-full bg-leaf px-5 py-2 font-semibold text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
