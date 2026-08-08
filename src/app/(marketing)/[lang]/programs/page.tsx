import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock, Users } from "lucide-react";

import { CtaLink, Eyebrow } from "@/components/marketing/brand";
import { Photo } from "@/components/marketing/photo";
import { Reveal } from "@/components/marketing/reveal";
import { isLocale, localePath } from "@/lib/i18n/config";
import { ROOMS, pick } from "@/lib/i18n/content";
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
    title: dict.programs.metaTitle,
    description: dict.programs.metaDescription,
    ...localeAlternates(lang, "/programs"),
  };
}

const toneClasses = {
  sun: "bg-sun-soft text-warning",
  leaf: "bg-leaf-soft text-leaf-dark",
  sky: "bg-sky-soft text-sky",
} as const;

export default async function ProgramsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.programs;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-balance font-display text-4xl font-bold sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-ink-soft">{t.body}</p>
      </Reveal>

      <div className="mt-16 space-y-16">
        {ROOMS.map((room, i) => (
          <Reveal key={room.key}>
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <Photo
                  src={room.photo}
                  alt={pick(room.alt, lang)}
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="aspect-[4/3] rounded-[2.5rem] border border-ink/10 shadow-pin-lg"
                />
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${toneClasses[room.tone]}`}
                >
                  {pick(room.pill, lang)}
                </span>
                <h2 className="mt-3 font-display text-3xl font-bold">
                  {pick(room.name, lang)}
                </h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-bold text-ink-faint">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" /> {pick(room.age, lang)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" /> {pick(room.hours, lang)}
                  </span>
                  <span>{pick(room.ratio, lang)}</span>
                </div>
                <p className="mt-4 text-lg text-ink-soft">{pick(room.intro, lang)}</p>
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {room.learn[lang].map((line) => (
                    <li key={line} className="flex items-center gap-2.5 font-semibold">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf-dark">
                        <Check className="size-4" />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-20">
        <div className="rounded-[2.5rem] bg-leaf-soft px-7 py-12 text-center sm:px-12">
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
              href={localePath(lang, "/about")}
              variant="outline"
              className="text-lg"
            >
              {t.cta.aboutUs}
            </CtaLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
