import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FallingToys } from "@/components/marketing/falling-toys";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { LOCALES, isLocale, localePath } from "@/lib/i18n/config";
import { CONTACT, pick } from "@/lib/i18n/content";
import { getDictionary } from "@/lib/i18n";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rihana.com";

/** Pre-render both language shells. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);

  return {
    title: {
      default: dict.meta.siteName,
      template: `%s · ${dict.meta.siteName}`,
    },
    openGraph: {
      siteName: dict.meta.siteName,
      locale: lang === "ar" ? "ar_EG" : "en_GB",
    },
  };
}

/**
 * Public marketing shell.
 *
 * This is the one indexable, unauthenticated zone — the mirror image of /portal
 * and /admin. It shares the app's construction-paper brand but has its own
 * header and footer, so a visitor never sees app chrome and a signed-in parent
 * never sees marketing chrome. There is no auth guard here on purpose:
 * everything under this group is meant to be seen by anyone, including search
 * engines.
 *
 * The `[lang]` segment carries the locale. English is served unprefixed and is
 * rewritten onto `/en` by proxy.ts, so this layout always has a concrete locale
 * to work with; anything that is not a known language 404s rather than
 * rendering a half-English page.
 */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  // Guards the dynamic segment: /xx/about must 404, not render in a fallback
  // language. (Next's own i18n guide prescribes exactly this.)
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  /*
   * Structured data for search engines — tells Google this is a childcare
   * business, with its contact details and hours. Localized, so the Arabic page
   * advertises an Arabic name and description.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ChildCare",
    name: dict.meta.siteName,
    description: dict.home.metaDescription,
    url: `${SITE_URL}${localePath(lang, "/")}`,
    telephone: CONTACT.phone.tel,
    image: `${SITE_URL}/marketing/hero.jpg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: pick(CONTACT.address, lang),
      addressLocality: lang === "ar" ? "المعادي" : "Maadi",
      addressRegion: lang === "ar" ? "القاهرة" : "Cairo",
      addressCountry: "EG",
    },
    openingHours: CONTACT.openingHoursSchema,
    areaServed: pick(CONTACT.city, lang),
    inLanguage: lang,
  };

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

      <SiteHeader locale={lang} dict={dict} />
      <main id="main" className="relative z-10 flex-1">
        {children}
      </main>
      <SiteFooter locale={lang} dict={dict} />
    </div>
  );
}
