import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "About us",
  description:
    "Rihana Montessori Academy is a warm, family-run nursery in Maadi, Cairo, where children learn through play in a safe, caring environment with qualified educators.",
};

const VALUES = [
  { icon: HandHeart, title: "Kindness first", body: "Every child is met with warmth, patience and a gentle hand." },
  { icon: Leaf, title: "Learning through play", body: "Play is how little ones make sense of the world — so we build the day around it." },
  { icon: Users, title: "Small, close groups", body: "Gentle group sizes mean every child is truly known and seen." },
  { icon: ShieldCheck, title: "Safe and secure", body: "Careful routines, secure entry and staff trained in first aid." },
  { icon: Smile, title: "Happy mornings", body: "We settle every child gently, so drop-off is full of smiles." },
  { icon: Sparkles, title: "Curiosity encouraged", body: "Questions, mess and wonder are always welcome here." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      {/* Intro */}
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>About Rihana</Eyebrow>
          <h1 className="mt-2 text-balance font-display text-4xl font-bold sm:text-5xl">
            A warm little world of our own
          </h1>
          <p className="mt-4 text-lg text-ink-soft">
            Rihana began with a simple wish: a nursery where children feel as safe
            and loved as they do at home. Today, in the heart of Maadi, our small
            team cares for little ones aged one to five — learning through play,
            growing in confidence, and making their very first friends.
          </p>
          <p className="mt-4 text-lg text-ink-soft">
            We keep our groups small on purpose. It&rsquo;s how we get to know
            every child — their comforts, their quirks and the things that make
            them light up.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <Photo
            src="/marketing/care.jpg"
            alt="An educator giving warm, one-to-one attention to a child"
            sizes="(max-width: 1024px) 100vw, 560px"
            className="aspect-[4/3] rounded-[2.5rem] border border-ink/10 shadow-pin-lg"
            priority
          />
        </Reveal>
      </div>

      {/* Values */}
      <section className="pt-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow tone="coral">What we believe</Eyebrow>
          <h2 className="mt-2 text-balance font-display text-4xl font-bold">
            The things that matter to us
          </h2>
        </Reveal>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((v, i) => (
            <li key={v.title}>
              <Reveal
                delay={(i % 3) * 90}
                className="h-full rounded-[1.5rem] border border-ink/8 bg-card p-6 shadow-pin"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-leaf-soft text-leaf-dark">
                  <v.icon className="size-6" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold">{v.title}</h3>
                <p className="mt-1.5 text-ink-soft">{v.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* Safety band */}
      <section className="pt-24">
        <Reveal>
          <div className="grid items-center gap-10 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-leaf to-leaf-dark px-7 py-12 text-white shadow-pin-lg sm:px-12 lg:grid-cols-2">
            <div>
              <span className="font-display text-xs font-bold uppercase tracking-[0.16em] text-sun">
                Safety &amp; wellbeing
              </span>
              <h2 className="mt-2 text-balance font-display text-4xl font-bold text-white">
                Cared for, every moment
              </h2>
              <p className="mt-4 max-w-md text-lg text-white/85">
                Your child&rsquo;s safety underpins everything we do — from who
                walks through the door to who walks back out with them.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Secure entry and careful sign-in",
                  "Staff trained in paediatric first aid",
                  "You decide exactly who may collect your child",
                  "Photos shared privately with your family only",
                ].map((line) => (
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
              alt="Children sitting calmly together on a mat"
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
            We&rsquo;d love to meet you
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">
            The warmth of Rihana is best felt in person. Come and say hello.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <CtaLink href="/enquire" className="text-lg">
              Book a visit <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </CtaLink>
            <CtaLink href="/programs" variant="outline" className="text-lg">
              Our programs
            </CtaLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
