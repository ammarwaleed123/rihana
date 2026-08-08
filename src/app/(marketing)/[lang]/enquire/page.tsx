import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, MapPin, Phone } from "lucide-react";

import { Eyebrow } from "@/components/marketing/brand";
import { Reveal } from "@/components/marketing/reveal";
import { isLocale } from "@/lib/i18n/config";
import { CONTACT, pick } from "@/lib/i18n/content";
import { getDictionary } from "@/lib/i18n";
import { localeAlternates } from "@/lib/i18n/metadata";

import { EnquireForm } from "./enquire-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);

  return {
    title: dict.enquire.metaTitle,
    description: dict.enquire.metaDescription,
    ...localeAlternates(lang, "/enquire"),
  };
}

export default async function EnquirePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ about?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.enquire;

  // The Visit page's "Book a visit" CTA links here with ?about=visit, so the
  // form arrives with "Book a visit" pre-selected. The "Enquire" nav leaves it
  // on the default question.
  const { about } = await searchParams;
  const defaultKind = about === "visit" ? "VISIT" : "QUESTION";

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-balance font-display text-4xl font-bold sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-ink-soft">{t.body}</p>
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="rounded-[2rem] border border-ink/8 bg-card p-6 shadow-pin sm:p-8">
          <EnquireForm locale={lang} t={t} defaultKind={defaultKind} />
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-[2rem] bg-leaf-soft p-6 shadow-pin sm:p-8">
            <h2 className="font-display text-xl font-bold">{t.preferToTalk}</h2>
            <p className="mt-2 text-ink-soft">{t.preferToTalkBody}</p>
            <ul className="mt-5 space-y-4 text-sm">
              <ContactRow icon={Phone} label={t.callUs}>
                <a
                  href={`tel:${CONTACT.phone.tel}`}
                  dir="ltr"
                  className="inline-block font-bold hover:text-leaf-dark"
                >
                  {CONTACT.phone.display}
                </a>
              </ContactRow>
              <ContactRow icon={MapPin} label={t.visitUs}>
                {pick(CONTACT.address, lang)}
              </ContactRow>
              <ContactRow icon={Clock} label={t.openLabel}>
                {pick(CONTACT.hours, lang)}
              </ContactRow>
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-leaf-dark shadow-pin">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-bold text-ink-faint">{label}</span>
        <span className="block">{children}</span>
      </span>
    </li>
  );
}
