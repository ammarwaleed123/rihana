import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Apple,
  ArrowRight,
  Baby,
  Bell,
  Camera,
  Check,
  Clock,
  GraduationCap,
  Heart,
  Palette,
  ShieldCheck,
  TreePine,
  Users,
} from "lucide-react";

import { CtaLink, Eyebrow } from "@/components/marketing/brand";
import { Photo } from "@/components/marketing/photo";
import { Reveal } from "@/components/marketing/reveal";
import { LOCALE_INTL, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { ROOMS, TESTIMONIALS, pick } from "@/lib/i18n/content";
import { getDictionary, type Dictionary } from "@/lib/i18n";
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
    title: dict.home.metaTitle,
    description: dict.home.metaDescription,
    ...localeAlternates(lang, "/"),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <Hero locale={lang} dict={dict} />
      <QuickFacts dict={dict} />
      <CareSection dict={dict} />
      <Programs locale={lang} dict={dict} />
      <WhyUs dict={dict} />
      <ADay dict={dict} />
      <StayConnected dict={dict} />
      <Testimonials locale={lang} dict={dict} />
      <VisitCta locale={lang} dict={dict} />
    </>
  );
}

/* ------------------------------------------------------------------ Hero -- */

function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.home.hero;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-8 sm:pt-12">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="m-rise inline-flex items-center gap-2 rounded-full bg-leaf-soft px-4 py-1.5 text-sm font-bold text-leaf-dark">
            <Heart className="size-4 text-coral" /> {t.badge}
          </span>
          <h1
            className="m-rise mt-5 text-balance font-display text-5xl font-bold leading-[1.05] sm:text-6xl"
            style={{ animationDelay: "0.08s" }}
          >
            {t.title}
          </h1>
          <p
            className="m-rise mt-5 max-w-md text-lg text-ink-soft"
            style={{ animationDelay: "0.16s" }}
          >
            {t.body}
          </p>
          <div
            className="m-rise mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "0.24s" }}
          >
            <CtaLink
              href={localePath(locale, "/enquire")}
              variant="sun"
              className="text-lg"
            >
              {dict.common.bookVisit}
              {/* The arrow points "forward", which is leftward in Arabic. */}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </CtaLink>
            <CtaLink
              href={localePath(locale, "/programs")}
              variant="outline"
              className="text-lg"
            >
              {dict.common.ourPrograms}
            </CtaLink>
          </div>
        </div>

        {/* Photo with a couple of pinned, construction-paper accents. The pins
            use logical start/end so they stay on the outer edge when mirrored. */}
        <div className="m-pop relative" style={{ animationDelay: "0.15s" }}>
          <Photo
            src="/marketing/hero.jpg"
            alt={t.photoAlt}
            priority
            sizes="(max-width: 1024px) 100vw, 560px"
            className="aspect-[4/3] rounded-[2.5rem] border border-ink/10 shadow-pin-lg"
          />
          <div className="absolute -bottom-5 -start-4 flex items-center gap-3 rounded-2xl bg-card p-3 pe-5 shadow-pin-lg">
            <span className="grid size-11 place-items-center rounded-xl bg-sun-soft text-warning">
              <GraduationCap className="size-6" />
            </span>
            <span className="whitespace-pre-line text-sm font-bold leading-tight">
              {t.badgeQualified}
            </span>
          </div>
          <div className="m-float absolute -end-3 -top-3 grid size-16 place-items-center rounded-full bg-sun text-ink shadow-pin">
            <span className="whitespace-pre-line text-center font-display text-xs font-bold leading-none">
              {t.badgeAges}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Quick facts -- */

function QuickFacts({ dict }: { dict: Dictionary }) {
  const f = dict.home.facts;
  const facts = [
    { icon: Baby, label: f.ages },
    { icon: GraduationCap, label: f.qualified },
    { icon: Users, label: f.smallGroups },
    { icon: Apple, label: f.meals },
    { icon: ShieldCheck, label: f.safe },
    { icon: Clock, label: f.hours },
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-16">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map(({ icon: Icon, label }, i) => (
          <li key={label}>
            <Reveal
              delay={i * 60}
              className="flex h-full flex-col items-center gap-2 rounded-2xl border border-ink/8 bg-card px-3 py-5 text-center shadow-pin"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-leaf-soft text-leaf-dark">
                <Icon className="size-5" />
              </span>
              <span className="text-sm font-bold leading-tight">{label}</span>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- Care ------ */

function CareSection({ dict }: { dict: Dictionary }) {
  const t = dict.home.care;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 className="mt-2 text-balance font-display text-4xl font-bold">
            {t.title}
          </h2>
          <p className="mt-4 text-lg text-ink-soft">{t.body}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {t.points.map((line) => (
              <li key={line} className="flex items-center gap-2.5 font-bold">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf-dark">
                  <Check className="size-4" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          <div className="relative">
            <Photo
              src="/marketing/care.jpg"
              alt={t.photoAlt}
              sizes="(max-width: 1024px) 100vw, 560px"
              className="aspect-[4/3] rounded-[2.5rem] border border-ink/10 shadow-pin-lg"
            />
            <div className="absolute -bottom-4 -end-3 rotate-3 rounded-2xl bg-coral-soft px-4 py-3 shadow-pin">
              <p className="font-display font-bold text-coral-dark">{t.sticker}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Programs -- */

const toneClasses = {
  sun: "bg-sun-soft text-warning",
  leaf: "bg-leaf-soft text-leaf-dark",
  sky: "bg-sky-soft text-sky",
} as const;

function Programs({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.home.programs;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow tone="sky">{t.eyebrow}</Eyebrow>
        <h2 className="mt-2 text-balance font-display text-4xl font-bold">
          {t.title}
        </h2>
        <p className="mt-3 text-lg text-ink-soft">{t.body}</p>
      </Reveal>

      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {ROOMS.map((room, i) => (
          <li key={room.key}>
            <Reveal delay={i * 100} className="h-full">
              <div className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-ink/8 bg-card shadow-pin transition-transform duration-200 hover:-translate-y-1">
                <Photo
                  src={room.photo}
                  alt={pick(room.alt, locale)}
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="aspect-[16/10]"
                />
                <div className="flex flex-1 flex-col p-6">
                  <span
                    className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-bold ${toneClasses[room.tone]}`}
                  >
                    {pick(room.pill, locale)}
                  </span>
                  <h3 className="mt-3 font-display text-2xl font-bold">
                    {pick(room.name, locale)}
                  </h3>
                  <p className="mt-0.5 font-bold text-ink-faint">
                    {pick(room.age, locale)} · {pick(room.hours, locale)}
                  </p>
                  <p className="mt-3 text-ink-soft">{pick(room.blurb, locale)}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <CtaLink href={localePath(locale, "/programs")} variant="outline">
          {dict.common.seeAllPrograms}
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
        </CtaLink>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Why us --- */

function WhyUs({ dict }: { dict: Dictionary }) {
  const t = dict.home.whyUs;
  // Icons pair with the dictionary entries by position, so the copy stays in
  // the dictionary and the imagery stays in the component.
  const icons = [GraduationCap, Users, Apple, TreePine, Palette, ShieldCheck];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow tone="coral">{t.eyebrow}</Eyebrow>
        <h2 className="mt-2 text-balance font-display text-4xl font-bold">
          {t.title}
        </h2>
      </Reveal>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.points.map((p, i) => {
          const Icon = icons[i] ?? GraduationCap;
          return (
            <li key={p.title}>
              <Reveal
                delay={(i % 3) * 90}
                className="h-full rounded-[1.5rem] border border-ink/8 bg-card p-6 shadow-pin"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-leaf-soft text-leaf-dark">
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold">{p.title}</h3>
                <p className="mt-1.5 text-ink-soft">{p.body}</p>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------- A day at Rihana -- */

const DAY_PHOTOS = [
  "/marketing/movement.jpg",
  "/marketing/art.jpg",
  "/marketing/reading.jpg",
  "/marketing/music.jpg",
  "/marketing/play.jpg",
  "/marketing/calm.jpg",
];

function ADay({ dict }: { dict: Dictionary }) {
  const t = dict.home.day;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h2 className="mt-2 text-balance font-display text-4xl font-bold">
          {t.title}
        </h2>
        <p className="mt-3 text-lg text-ink-soft">{t.body}</p>
      </Reveal>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.tiles.map((tile, i) => (
          <li key={tile.label}>
            <Reveal delay={(i % 3) * 90}>
              <div className="group relative overflow-hidden rounded-[1.5rem] border border-ink/10 shadow-pin">
                <Photo
                  src={DAY_PHOTOS[i] ?? DAY_PHOTOS[0]}
                  alt={tile.alt}
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="aspect-[4/3] transition-transform duration-300 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-4 pt-10">
                  <p className="font-display text-lg font-bold text-white">
                    {tile.label}
                  </p>
                  <p className="text-sm text-white/85">{tile.caption}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------- Stay connected (portal) */

function StayConnected({ dict }: { dict: Dictionary }) {
  const t = dict.home.connected;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal>
        <div className="grid items-center gap-8 overflow-hidden rounded-[2.5rem] bg-leaf-soft px-7 py-10 sm:px-12 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <h2 className="mt-2 text-balance font-display text-3xl font-bold sm:text-4xl">
              {t.title}
            </h2>
            <p className="mt-3 max-w-lg text-lg text-ink-soft">{t.body}</p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-bold">
              <li className="flex items-center gap-2">
                <Camera className="size-5 text-leaf" /> {t.pillPhotos}
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-leaf" /> {t.pillPickup}
              </li>
              <li className="flex items-center gap-2">
                <Bell className="size-5 text-leaf" /> {t.pillUpdates}
              </li>
            </ul>
            <p className="mt-4 text-sm text-ink-faint">{t.note}</p>
          </div>

          {/* small phone peek — deliberately modest, this is one feature */}
          <div className="mx-auto w-full max-w-[13rem]">
            <div className="rotate-2 rounded-[1.75rem] border-4 border-card bg-card p-2.5 shadow-pin-lg">
              <div className="rounded-2xl bg-paper p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-leaf text-white">
                    <Heart className="size-3.5" />
                  </span>
                  <span className="font-display text-xs font-bold">
                    {dict.meta.siteName}
                  </span>
                </div>
                <div className="relative mt-2.5 aspect-[4/3] overflow-hidden rounded-xl">
                  <Photo
                    src="/marketing/movement.jpg"
                    alt=""
                    sizes="220px"
                    className="aspect-[4/3]"
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-leaf-soft px-2.5 py-1.5">
                  <Camera className="size-3.5 text-leaf-dark" />
                  <span className="text-xs font-bold text-leaf-dark">
                    {t.phoneNotification}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ----------------------------------------------------------- Testimonials -- */

const avatarTone = {
  coral: "bg-coral-soft text-coral-dark",
  sky: "bg-sky-soft text-sky",
  sun: "bg-sun-soft text-warning",
} as const;

function Testimonials({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.home.testimonials;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow tone="coral">{t.eyebrow}</Eyebrow>
        <h2 className="mt-2 font-display text-4xl font-bold">{t.title}</h2>
      </Reveal>

      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((q, i) => {
          const name = pick(q.name, locale);
          return (
            <li key={name}>
              <Reveal delay={i * 100} className="h-full">
                <figure className="flex h-full flex-col rounded-[1.75rem] border border-ink/8 bg-card p-6 shadow-pin">
                  <blockquote className="flex-1 font-display text-lg text-ink">
                    &ldquo;{pick(q.quote, locale)}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span
                      className={`grid size-11 place-items-center rounded-full font-display text-lg font-bold ${avatarTone[q.tone]}`}
                    >
                      {name.charAt(0)}
                    </span>
                    <span>
                      <span className="block font-display font-bold">{name}</span>
                      <span className="block text-sm text-ink-faint">
                        {pick(q.role, locale)}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------- Visit CTA -- */

function VisitCta({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const t = dict.home.visitCta;
  const numbers = new Intl.NumberFormat(LOCALE_INTL[locale]);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal>
        <div className="overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-sun-soft via-coral-soft to-sky-soft px-7 py-14 sm:px-12 sm:py-16">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-balance font-display text-4xl font-bold sm:text-5xl">
              {t.title}
            </h2>
            <p className="mt-4 text-lg text-ink-soft">{t.body}</p>
          </div>

          <ol className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            {t.steps.map((s, i) => (
              <li
                key={s.title}
                className="rounded-2xl bg-card/70 p-5 text-center backdrop-blur-sm"
              >
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-leaf font-display text-lg font-bold text-white">
                  {/* Localized numeral — Arabic readers get ١ ٢ ٣. */}
                  {numbers.format(i + 1)}
                </span>
                <h3 className="mt-3 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <CtaLink href={localePath(locale, "/enquire")} className="text-lg">
              {dict.common.bookVisit}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </CtaLink>
            <CtaLink
              href={localePath(locale, "/visit")}
              variant="outline"
              className="text-lg"
            >
              {dict.common.findUs}
            </CtaLink>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
