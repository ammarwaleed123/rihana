import type { Metadata } from "next";
import { Clock, MapPin, Phone } from "lucide-react";

import { Eyebrow } from "@/components/marketing/brand";
import { Reveal } from "@/components/marketing/reveal";

import { EnquireForm } from "./enquire-form";

export const metadata: Metadata = {
  title: "Enquire about a place",
  description:
    "Enquire about a place at Rihana Montessori Academy in Maadi, Cairo. Tell us a little about your child and we'll be in touch to arrange a visit.",
};

export default function EnquirePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>Admissions</Eyebrow>
        <h1 className="mt-2 text-balance font-display text-4xl font-bold sm:text-5xl">
          Let&rsquo;s find your child a place
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Send us a little about your child and we&rsquo;ll be in touch to answer
          your questions and arrange a warm welcome.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="rounded-[2rem] border border-ink/8 bg-card p-6 shadow-pin sm:p-8">
          <EnquireForm />
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-[2rem] bg-leaf-soft p-6 shadow-pin sm:p-8">
            <h2 className="font-display text-xl font-bold">Prefer to talk?</h2>
            <p className="mt-2 text-ink-soft">
              We&rsquo;re happy to chat any time during opening hours.
            </p>
            <ul className="mt-5 space-y-4 text-sm">
              <ContactRow icon={Phone} label="Call us">
                <a href="tel:+201000000000" className="font-bold hover:text-leaf-dark">
                  +20 100 000 0000
                </a>
              </ContactRow>
              <ContactRow icon={MapPin} label="Visit us">
                12 Garden Street, Maadi, Cairo
              </ContactRow>
              <ContactRow icon={Clock} label="Open">
                Sunday – Thursday, 8am – 4pm
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
