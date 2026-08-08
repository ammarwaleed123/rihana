import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";

import { CtaLink, Eyebrow } from "@/components/marketing/brand";
import { Reveal } from "@/components/marketing/reveal";
import { isLocale, localePath } from "@/lib/i18n/config";
import { CONTACT, FAQ, pick } from "@/lib/i18n/content";
import { getDictionary } from "@/lib/i18n";
import { localeAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);

  return {
    title: dict.visit.metaTitle,
    description: dict.visit.metaDescription,
    ...localeAlternates(lang, "/visit"),
  };
}

export default async function VisitPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.visit;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-balance font-display text-4xl font-bold sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-ink-soft">{t.body}</p>
      </Reveal>

      {/* Contact + map */}
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-[2rem] border border-ink/8 bg-card p-6 shadow-pin sm:p-8">
            <h2 className="font-display text-2xl font-bold">{t.findUs}</h2>
            <ul className="mt-5 space-y-5">
              <InfoRow icon={MapPin} label={t.address}>
                {pick(CONTACT.address, lang)}
              </InfoRow>
              <InfoRow icon={Clock} label={t.openingHours}>
                {pick(CONTACT.hours, lang)}
              </InfoRow>
              <InfoRow icon={Phone} label={t.phone}>
                {/* Phone numbers read left-to-right even inside Arabic text. */}
                <a
                  href={`tel:${CONTACT.phone.tel}`}
                  dir="ltr"
                  className="inline-block font-bold hover:text-leaf-dark"
                >
                  {CONTACT.phone.display}
                </a>
              </InfoRow>
              <InfoRow icon={Mail} label={t.email}>
                <a
                  href={`mailto:${CONTACT.email}`}
                  dir="ltr"
                  className="inline-block font-bold hover:text-leaf-dark"
                >
                  {CONTACT.email}
                </a>
              </InfoRow>
            </ul>
            <div className="mt-6">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(CONTACT.mapsQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-leaf underline underline-offset-4"
              >
                {dict.common.getDirections}
                <ArrowRight className="size-4 rtl:-scale-x-100" />
              </a>
            </div>
          </div>
        </Reveal>

        {/* Decorative "map" — a styled placeholder, not an external embed */}
        <Reveal delay={100}>
          <div className="relative flex h-full min-h-[16rem] items-center justify-center overflow-hidden rounded-[2rem] border border-ink/10 bg-leaf-soft shadow-pin">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0 38px, rgba(51,64,47,0.06) 38px 40px), repeating-linear-gradient(90deg, transparent 0 38px, rgba(51,64,47,0.06) 38px 40px)",
              }}
            />
            <div className="relative flex flex-col items-center text-center">
              <span className="grid size-14 place-items-center rounded-full bg-coral text-white shadow-pin-lg">
                <MapPin className="size-7" />
              </span>
              <p className="mt-3 font-display text-lg font-bold text-leaf-dark">
                {pick(CONTACT.city, lang)}
              </p>
              <p className="text-sm text-ink-soft">{t.mapCaption}</p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* FAQ */}
      <section className="pt-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow tone="sky">{t.faqEyebrow}</Eyebrow>
          <h2 className="mt-2 text-balance font-display text-4xl font-bold">
            {t.faqTitle}
          </h2>
        </Reveal>

        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQ.map((item, i) => {
            const q = pick(item.q, lang);
            return (
              <Reveal key={q} delay={(i % 4) * 60}>
                <details className="group rounded-2xl border border-ink/10 bg-card px-5 py-4 shadow-pin [&_summary]:cursor-pointer">
                  <summary className="flex items-center justify-between gap-4 font-display text-lg font-bold marker:content-none">
                    {q}
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf-dark transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-ink-soft">{pick(item.a, lang)}</p>
                </details>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <Reveal className="pt-20">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-sun-soft via-coral-soft to-sky-soft px-7 py-12 text-center sm:px-12">
          <h2 className="text-balance font-display text-3xl font-bold sm:text-4xl">
            {t.cta.title}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">{t.cta.body}</p>
          <div className="mt-7 flex justify-center">
            <CtaLink href={localePath(lang, "/enquire?about=visit")} className="text-lg">
              {dict.common.bookVisit}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </CtaLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-leaf-soft text-leaf-dark">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-sm font-bold text-ink-faint">{label}</span>
        <span className="mt-0.5 block">{children}</span>
      </span>
    </li>
  );
}
