import type { Metadata } from "next";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";

import { CtaLink, Eyebrow } from "@/components/marketing/brand";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Visit us",
  description:
    "Find Rihana Montessori Academy in Maadi, Cairo. Opening hours, location, how to enrol, and answers to common questions. Come and visit — we'd love to show you around.",
};

const FAQ = [
  {
    q: "What ages do you take?",
    a: "We welcome children from 1 to 5 years, across three age groups: Sunflowers (1–2), Olives (2–4) and Cedars (4–5).",
  },
  {
    q: "What are your hours?",
    a: "We're open Sunday to Thursday. Sessions run from 8am, finishing at 2pm, 3pm or 4pm depending on your child's group.",
  },
  {
    q: "Do you provide meals?",
    a: "Yes — fresh, balanced meals and snacks are prepared on site each day. Let us know about any allergies or dietary needs.",
  },
  {
    q: "How does settling in work?",
    a: "Gently, and at your child's pace. We build up gradually with a familiar key person, so your little one feels safe from the start.",
  },
  {
    q: "What are the fees?",
    a: "Fees depend on your child's group and days. We'll share the current fees and availability when you enquire or visit.",
  },
  {
    q: "How do I enrol?",
    a: "Send us an enquiry, come for a visit, and — when you're ready — we'll help your child settle in. That's it.",
  },
];

export default function VisitPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>Visit us</Eyebrow>
        <h1 className="mt-2 text-balance font-display text-4xl font-bold sm:text-5xl">
          Come and see us
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          The best way to get a feel for Rihana is to visit. Here&rsquo;s where to
          find us and how to get in touch.
        </p>
      </Reveal>

      {/* Contact + map */}
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-[2rem] border border-ink/8 bg-card p-6 shadow-pin sm:p-8">
            <h2 className="font-display text-2xl font-bold">Find us</h2>
            <ul className="mt-5 space-y-5">
              <InfoRow icon={MapPin} label="Address">
                12 Garden Street, Maadi, Cairo, Egypt
              </InfoRow>
              <InfoRow icon={Clock} label="Opening hours">
                Sunday – Thursday, 8am – 4pm
                <br />
                <span className="text-ink-faint">Closed Friday &amp; Saturday</span>
              </InfoRow>
              <InfoRow icon={Phone} label="Phone">
                <a href="tel:+201000000000" className="font-bold hover:text-leaf-dark">
                  +20 100 000 0000
                </a>
              </InfoRow>
              <InfoRow icon={Mail} label="Email">
                <a href="mailto:hello@rihana.com" className="font-bold hover:text-leaf-dark">
                  hello@rihana.com
                </a>
              </InfoRow>
            </ul>
            <div className="mt-6">
              <a
                href="https://maps.google.com/?q=Maadi,Cairo,Egypt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-leaf underline underline-offset-4"
              >
                Get directions <ArrowRight className="size-4" />
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
                Maadi, Cairo
              </p>
              <p className="text-sm text-ink-soft">A leafy, quiet corner of the city</p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* FAQ */}
      <section className="pt-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow tone="sky">Good to know</Eyebrow>
          <h2 className="mt-2 text-balance font-display text-4xl font-bold">
            Questions parents often ask
          </h2>
        </Reveal>

        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={(i % 4) * 60}>
              <details className="group rounded-2xl border border-ink/10 bg-card px-5 py-4 shadow-pin [&_summary]:cursor-pointer">
                <summary className="flex items-center justify-between gap-4 font-display text-lg font-bold marker:content-none">
                  {item.q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf-dark transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-ink-soft">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <Reveal className="pt-20">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-sun-soft via-coral-soft to-sky-soft px-7 py-12 text-center sm:px-12">
          <h2 className="text-balance font-display text-3xl font-bold sm:text-4xl">
            Ready to visit?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">
            Send a quick enquiry and we&rsquo;ll arrange a time that suits you.
          </p>
          <div className="mt-7 flex justify-center">
            <CtaLink href="/enquire" className="text-lg">
              Book a visit <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
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
