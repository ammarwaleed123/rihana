import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2, Fredoka, Nunito, Tajawal } from "next/font/google";
import { headers } from "next/headers";

import { NavProgress } from "@/components/nav-progress";
import { AppleSplash } from "@/components/pwa/apple-splash";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker";
import {
  LOCALE_DIR,
  LOCALE_HEADER,
  LOCALE_HTML_LANG,
  isLocale,
} from "@/lib/i18n/config";
import { readLocaleCookie } from "@/lib/i18n/locale-cookie";

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

/*
 * Arabic faces. Fredoka and Nunito carry no Arabic glyphs, so without these an
 * Arabic page would silently fall back to whatever the device happens to have —
 * different on every phone, and nothing like the brand.
 *
 * They are not swapped in conditionally. Both stacks list the Latin face first
 * and the Arabic face straight after (see --font-display / --font-sans in
 * globals.css); font fallback is per-glyph, so Latin characters take Fredoka /
 * Nunito and Arabic characters take Baloo / Tajawal automatically — including
 * within a single mixed sentence like "زورونا in Maadi".
 *
 * Baloo Bhaijaan 2 is the closest Arabic match to Fredoka's rounded, friendly
 * display voice; Tajawal is the humanist counterpart to Nunito for body text.
 */
const balooArabic = Baloo_Bhaijaan_2({
  variable: "--font-baloo-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

/** The one string in the root shell, which sits above any dictionary. */
const SKIP_TO_CONTENT = {
  en: "Skip to content",
  ar: "تخطَّ إلى المحتوى",
};

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
  // Next auto-links the manifest from app/manifest.ts; this adds the iOS
  // home-screen icon and the standalone status-bar treatment.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Rihana", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FFF9EF",
  width: "device-width",
  initialScale: 1,
  // Draw into the notch/rounded corners when installed, so the app fills the
  // screen like a native one. This is also what makes env(safe-area-inset-*)
  // report real values — the headers and bottom tab bar pad themselves off it.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
   * Two sources, and the order matters.
   *
   * For the public site and the auth pages, proxy.ts resolves the locale from
   * the URL and stamps it as a header — this layout sits above the `[lang]`
   * segment and cannot read it from params.
   *
   * For the private app the proxy stamps nothing, and the cookie is read here
   * instead. That is what makes "Save language" take effect on the first press:
   * a header is frozen when the request arrives, whereas the cookie store
   * already reflects the value the server action just wrote.
   */
  const headerLocale = (await headers()).get(LOCALE_HEADER);
  const locale = isLocale(headerLocale)
    ? headerLocale
    : await readLocaleCookie();

  return (
    <html
      lang={LOCALE_HTML_LANG[locale]}
      dir={LOCALE_DIR[locale]}
      className={`${fredoka.variable} ${nunito.variable} ${balooArabic.variable} ${tajawal.variable} h-full antialiased`}
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
          className="sr-only-focusable absolute start-4 top-4 z-50 rounded-full bg-leaf px-5 py-2 font-semibold text-white"
        >
          {SKIP_TO_CONTENT[locale]}
        </a>
        <NavProgress />
        {children}
        <AppleSplash />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
