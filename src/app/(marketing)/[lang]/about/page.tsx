import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  HandHeart,
  Leaf,
  ShieldCheck,
  Smile,
  Sparkles,
  Users,
} from "lucide-react";

import { CtaLink, Eyebrow } from "@/components/marketing/brand";
import { Photo } from "@/components/marketing/photo";
import { Reveal } from "@/components/marketing/reveal";
import { isLocale, localePath } from "@/lib/i18n/config";
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
    title: dict.about.metaTitle,
    description: dict.about.metaDescription,
    ...localeAlternates(lang, "/about"),
  };
}

// Paired by position with dict.about.values.items.
const VALUE_ICONS = [HandHeart, Leaf, Users, ShieldCheck, Smile, Sparkles];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.about;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      {/* Intro */}
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="mt-2 text-balance font-display text-4xl font-bold sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 text-lg text-ink-soft">{t.body1}</p>
          <p className="mt-4 text-lg text-ink-soft">{t.body2}</p>
        </Reveal>
        <Reveal delay={100}>
          <Photo
            src="/marketing/care.jpg"
            alt={t.photoAlt}
            sizes="(max-width: 1024px) 100vw, 560px"
            className="aspect-[4/3] rounded-[2.5rem] border border-ink/10 shadow-pin-lg"
            priority
          />
        </Reveal>
      </div>

      {/* Values */}
      <section className="pt-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow tone="coral">{t.values.eyebrow}</Eyebrow>
          <h2 className="mt-2 text-balance font-display text-4xl font-bold">
            {t.values.title}
          </h2>
        </Reveal>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.values.items.map((v, i) => {
            const Icon = VALUE_ICONS[i] ?? HandHeart;
            return (
              <li key={v.title}>
                <Reveal
                  delay={(i % 3) * 90}
                  className="h-full rounded-[1.5rem] border border-ink/8 bg-card p-6 shadow-pin"
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-leaf-soft text-leaf-dark">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-4 font-display text-xl font-bold">{v.title}</h3>
                  <p className="mt-1.5 text-ink-soft">{v.body}</p>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Safety band */}
      <section className="pt-24">
        <Reveal>
          <div className="grid items-center gap-10 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-leaf to-leaf-dark px-7 py-12 text-white shadow-pin-lg sm:px-12 lg:grid-cols-2">
            <div>
              <span className="u-eyebrow font-display text-xs font-bold uppercase tracking-[0.16em] text-sun">
                {t.safety.eyebrow}
              </span>
              <h2 className="mt-2 text-balance font-display text-4xl font-bold text-white">
                {t.safety.title}
              </h2>
              <p className="mt-4 max-w-md text-lg text-white/85">{t.safety.body}</p>
              <ul className="mt-6 space-y-3">
                {t.safety.points.map((line) => (
                  <li key={line} className="flex items-center gap-3 font-bold">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/15">
                      <ShieldCheck className="size-4" />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <Photo
              src="/marketing/calm.jpg"
              alt={t.safety.photoAlt}
              sizes="(max-width: 1024px) 100vw, 480px"
              className="aspect-[4/3] rounded-[2rem] border-4 border-white/20 shadow-pin-lg"
            />
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <Reveal className="pt-20">
        <div className="rounded-[2.5rem] bg-sun-soft px-7 py-12 text-center sm:px-12">
          <h2 className="text-balance font-display text-3xl font-bold">
            {t.cta.title}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">{t.cta.body}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <CtaLink href={localePath(lang, "/enquire")} className="text-lg">
              {dict.common.bookVisit}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </CtaLink>
            <CtaLink
              href={localePath(lang, "/programs")}
              variant="outline"
              className="text-lg"
            >
              {dict.common.ourPrograms}
            </CtaLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
