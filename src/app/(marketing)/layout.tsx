import { FallingToys } from "@/components/marketing/falling-toys";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rihana.com";

/**
 * Structured data for search engines — tells Google this is a childcare
 * business, with its contact details and hours. Replace the placeholder address
 * and phone with the nursery's real ones (see public/marketing/README.md).
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ChildCare",
  name: "Rihana Montessori Academy",
  description:
    "A warm, playful nursery in Maadi, Cairo for children aged 1–5 — learning through play, in small, caring groups.",
  url: SITE_URL,
  telephone: "+20 100 000 0000",
  image: `${SITE_URL}/marketing/hero.jpg`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "12 Garden Street",
    addressLocality: "Maadi",
    addressRegion: "Cairo",
    addressCountry: "EG",
  },
  openingHours: "Su-Th 08:00-16:00",
  areaServed: "Maadi, Cairo",
};

/**
 * Public marketing shell.
 *
 * This is the one indexable, unauthenticated zone — the mirror image of /portal
 * and /admin. It shares the app's construction-paper brand but has its own
 * header and footer, so a visitor never sees app chrome and a signed-in parent
 * never sees marketing chrome. There is no auth guard here on purpose: everything
 * under this group is meant to be seen by anyone, including search engines.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Structured data. A string child, not dangerouslySetInnerHTML, so it
          stays within the project's no-danger rule. */}
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      {/*
        No-JS fallback for the scroll-reveal animation. Reveal targets start
        hidden (globals.css) and are un-hidden by the observer once in view; if
        JS never runs, this style shows them anyway, so crawlers and no-JS
        visitors never get invisible content. `<noscript>` renders only when
        scripting is off, so it costs JS visitors nothing.
      */}
      <noscript>
        <style>{`[data-reveal]{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      {/* Ambient animated background — sits behind everything (z-0); the header
          and content below sit above it via their own stacking. */}
      <FallingToys />

      <SiteHeader />
      <main id="main" className="relative z-10 flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
