import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "A warm nursery in Maadi, Cairo for ages 1–5",
  description:
    "Rihana Montessori Academy is a warm, playful nursery in Maadi, Cairo, where children aged 1–5 are cared for by qualified educators — learning through play in small, happy groups with nutritious meals and safe, secure days.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <QuickFacts />
      <CareSection />
      <Programs />
      <WhyUs />
      <ADay />
      <StayConnected />
      <Testimonials />
      <VisitCta />
    </>
  );
}

/* ------------------------------------------------------------------ Hero -- */

function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-8 sm:pt-12">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="m-rise inline-flex items-center gap-2 rounded-full bg-leaf-soft px-4 py-1.5 text-sm font-bold text-leaf-dark">
            <Heart className="size-4 text-coral" /> Nursery in Maadi, Cairo · ages 1–5
          </span>
          <h1
            className="m-rise mt-5 text-balance font-display text-5xl font-bold leading-[1.05] sm:text-6xl"
            style={{ animationDelay: "0.08s" }}
          >
            Where little ones love to learn
          </h1>
          <p
            className="m-rise mt-5 max-w-md text-lg text-ink-soft"
            style={{ animationDelay: "0.16s" }}
          >
            A warm, playful nursery in the heart of Maadi — where your child is
            cared for, kept safe, and encouraged to explore something new every
            single day.
          </p>
          <div
            className="m-rise mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "0.24s" }}
          >
            <CtaLink href="/enquire" variant="sun" className="text-lg">
              Book a visit <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </CtaLink>
            <CtaLink href="/programs" variant="outline" className="text-lg">
              Our programs
            </CtaLink>
          </div>
        </div>

        {/* Photo with a couple of pinned, construction-paper accents */}
        <div className="m-pop relative" style={{ animationDelay: "0.15s" }}>
          <Photo
            src="/marketing/hero.jpg"
            alt="An educator and children painting together at a bright nursery table"
            priority
            sizes="(max-width: 1024px) 100vw, 560px"
            className="aspect-[4/3] rounded-[2.5rem] border border-ink/10 shadow-pin-lg"
          />
          <div className="absolute -bottom-5 -left-4 flex items-center gap-3 rounded-2xl bg-card p-3 pr-5 shadow-pin-lg">
            <span className="grid size-11 place-items-center rounded-xl bg-sun-soft text-warning">
              <GraduationCap className="size-6" />
            </span>
            <span className="text-sm font-bold leading-tight">
              Qualified,
              <br />
              caring educators
            </span>
          </div>
          <div className="m-float absolute -right-3 -top-3 grid size-16 place-items-center rounded-full bg-sun text-ink shadow-pin">
            <span className="text-center font-display text-xs font-bold leading-none">
              ages
              <br />
              1–5
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Quick facts -- */

function QuickFacts() {
  const facts = [
    { icon: Baby, label: "Ages 1 to 5" },
    { icon: GraduationCap, label: "Qualified educators" },
    { icon: Users, label: "Small, happy groups" },
    { icon: Apple, label: "Fresh, healthy meals" },
    { icon: ShieldCheck, label: "Safe & secure" },
    { icon: Clock, label: "Sun–Thu, 8am–4pm" },
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

function CareSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <Eyebrow>Warm from the first hello</Eyebrow>
          <h2 className="mt-2 text-balance font-display text-4xl font-bold">
            A gentle place to be little
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Settling in is done at your child&rsquo;s pace, with a familiar key
            person who learns their name, their comforts and their little ways —
            so mornings are full of smiles, not tears.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "A familiar key person",
              "Gentle, unhurried settling-in",
              "A warm, predictable routine",
              "Cuddles and encouragement",
            ].map((line) => (
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
              alt="An educator helping two young children with a paper craft"
              sizes="(max-width: 1024px) 100vw, 560px"
              className="aspect-[4/3] rounded-[2.5rem] border border-ink/10 shadow-pin-lg"
            />
            <div className="absolute -bottom-4 -right-3 rotate-3 rounded-2xl bg-coral-soft px-4 py-3 shadow-pin">
              <p className="font-display font-bold text-coral-dark">
                Kindness first ♥
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Programs -- */

const PROGRAMS = [
  {
    pill: "Toddlers",
    name: "Sunflowers",
    age: "1–2 years",
    hours: "8am – 2pm",
    blurb: "First steps away from home: songs, sensory play and lots of cuddles.",
    photo: "/marketing/music.jpg",
    alt: "Toddlers playing musical bells with an educator",
    tone: "sun",
  },
  {
    pill: "Preschool",
    name: "Olives",
    age: "2–4 years",
    hours: "8am – 3pm",
    blurb: "Sharing, stories and messy art as little friendships begin.",
    photo: "/marketing/art.jpg",
    alt: "Preschoolers painting at a table",
    tone: "leaf",
  },
  {
    pill: "Pre-K",
    name: "Cedars",
    age: "4–5 years",
    hours: "8am – 4pm",
    blurb: "Early letters and numbers, getting ready for big school.",
    photo: "/marketing/reading.jpg",
    alt: "An educator reading a story to a group of children",
    tone: "sky",
  },
] as const;

const toneClasses = {
  sun: "bg-sun-soft text-warning",
  leaf: "bg-leaf-soft text-leaf-dark",
  sky: "bg-sky-soft text-sky",
} as const;

function Programs() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow tone="sky">A room for every age</Eyebrow>
        <h2 className="mt-2 text-balance font-display text-4xl font-bold">
          Three rooms, one happy family
        </h2>
        <p className="mt-3 text-lg text-ink-soft">
          Your child grows through three age groups, each with its own gentle
          rhythm — and a familiar face who knows them by name.
        </p>
      </Reveal>

      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {PROGRAMS.map((p, i) => (
          <li key={p.name}>
            <Reveal delay={i * 100} className="h-full">
              <div className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-ink/8 bg-card shadow-pin transition-transform duration-200 hover:-translate-y-1">
                <Photo
                  src={p.photo}
                  alt={p.alt}
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="aspect-[16/10]"
                />
                <div className="flex flex-1 flex-col p-6">
                  <span className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-bold ${toneClasses[p.tone]}`}>
                    {p.pill}
                  </span>
                  <h3 className="mt-3 font-display text-2xl font-bold">{p.name}</h3>
                  <p className="mt-0.5 font-bold text-ink-faint">
                    {p.age} · {p.hours}
                  </p>
                  <p className="mt-3 text-ink-soft">{p.blurb}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <CtaLink href="/programs" variant="outline">
          See all programs <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
        </CtaLink>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Why us --- */

function WhyUs() {
  const points = [
    {
      icon: GraduationCap,
      title: "Qualified, caring staff",
      body: "Trained early-years educators who genuinely love what they do.",
    },
    {
      icon: Users,
      title: "Small groups",
      body: "Gentle group sizes, so every child is seen, heard and known.",
    },
    {
      icon: Apple,
      title: "Nutritious meals",
      body: "Fresh, balanced meals and snacks prepared daily on site.",
    },
    {
      icon: TreePine,
      title: "Outdoor play",
      body: "Fresh air, garden play and messy fun, come rain or shine.",
    },
    {
      icon: Palette,
      title: "Learning through play",
      body: "Art, music, stories and discovery — the way little ones learn best.",
    },
    {
      icon: ShieldCheck,
      title: "Safe & secure",
      body: "Secure entry, trained-in-first-aid staff, and careful daily routines.",
    },
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow tone="coral">Why families choose us</Eyebrow>
        <h2 className="mt-2 text-balance font-display text-4xl font-bold">
          Everything your child needs to thrive
        </h2>
      </Reveal>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((p, i) => (
          <li key={p.title}>
            <Reveal
              delay={(i % 3) * 90}
              className="h-full rounded-[1.5rem] border border-ink/8 bg-card p-6 shadow-pin"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-leaf-soft text-leaf-dark">
                <p.icon className="size-6" />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold">{p.title}</h3>
              <p className="mt-1.5 text-ink-soft">{p.body}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------- A day at Rihana -- */

const DAY = [
  { src: "/marketing/movement.jpg", label: "Move & groove", caption: "Dancing and active play", alt: "Children with arms raised, dancing in a playroom" },
  { src: "/marketing/art.jpg", label: "Creative play", caption: "Painting, gluing, making", alt: "Children painting with watercolours" },
  { src: "/marketing/reading.jpg", label: "Story & language", caption: "Books, songs, new words", alt: "An educator reading a story to children" },
  { src: "/marketing/music.jpg", label: "Music & circle time", caption: "Bells, rhythm, singing", alt: "Children playing musical bells" },
  { src: "/marketing/play.jpg", label: "Imagine & pretend", caption: "Dress-up and role play", alt: "Children in costumes during imaginative play" },
  { src: "/marketing/calm.jpg", label: "Calm & rest", caption: "Quiet time to recharge", alt: "Children sitting calmly on a mat" },
] as const;

function ADay() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow>A day at Rihana</Eyebrow>
        <h2 className="mt-2 text-balance font-display text-4xl font-bold">
          Every day is full of good things
        </h2>
        <p className="mt-3 text-lg text-ink-soft">
          Busy hands, curious minds and plenty of rest — here&rsquo;s a peek at
          the kinds of things that fill a day.
        </p>
      </Reveal>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DAY.map((tile, i) => (
          <li key={tile.label}>
            <Reveal delay={(i % 3) * 90}>
              <div className="group relative overflow-hidden rounded-[1.5rem] border border-ink/10 shadow-pin">
                <Photo
                  src={tile.src}
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

function StayConnected() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal>
        <div className="grid items-center gap-8 overflow-hidden rounded-[2.5rem] bg-leaf-soft px-7 py-10 sm:px-12 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <Eyebrow>For our families</Eyebrow>
            <h2 className="mt-2 text-balance font-display text-3xl font-bold sm:text-4xl">
              Peace of mind, every day
            </h2>
            <p className="mt-3 max-w-lg text-lg text-ink-soft">
              Once your child joins us, you get a private family app: see their
              day in photos, know exactly who is allowed to collect them, and
              hear from us the moment there&rsquo;s news.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-bold">
              <li className="flex items-center gap-2">
                <Camera className="size-5 text-leaf" /> Daily photos
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-leaf" /> You choose who collects
              </li>
              <li className="flex items-center gap-2">
                <Bell className="size-5 text-leaf" /> Gentle updates
              </li>
            </ul>
            <p className="mt-4 text-sm text-ink-faint">
              Every photo is private — shared only with your own family, never on
              this public site.
            </p>
          </div>

          {/* small phone peek — deliberately modest, this is one feature */}
          <div className="mx-auto w-full max-w-[13rem]">
            <div className="rotate-2 rounded-[1.75rem] border-4 border-card bg-card p-2.5 shadow-pin-lg">
              <div className="rounded-2xl bg-paper p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-leaf text-white">
                    <Heart className="size-3.5" />
                  </span>
                  <span className="font-display text-xs font-bold">Rihana Montessori Academy</span>
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
                    2 new photos today
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

const QUOTES = [
  {
    quote:
      "She runs in every morning without looking back. The staff genuinely know and love her.",
    name: "Mona A.",
    role: "mum in Sunflowers",
    tone: "coral",
  },
  {
    quote:
      "Warm, safe and organised. Knowing exactly who can collect him put my mind completely at ease.",
    name: "Khaled R.",
    role: "dad in Cedars",
    tone: "sky",
  },
  {
    quote:
      "The meals, the garden, the little art projects — it feels like a home away from home.",
    name: "Salma H.",
    role: "mum in Olives",
    tone: "sun",
  },
] as const;

const avatarTone = {
  coral: "bg-coral-soft text-coral-dark",
  sky: "bg-sky-soft text-sky",
  sun: "bg-sun-soft text-warning",
} as const;

function Testimonials() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow tone="coral">Loved by families</Eyebrow>
        <h2 className="mt-2 font-display text-4xl font-bold">
          Kind words from our parents
        </h2>
      </Reveal>

      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {QUOTES.map((q, i) => (
          <li key={q.name}>
            <Reveal delay={i * 100} className="h-full">
              <figure className="flex h-full flex-col rounded-[1.75rem] border border-ink/8 bg-card p-6 shadow-pin">
                <blockquote className="flex-1 font-display text-lg text-ink">
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span
                    className={`grid size-11 place-items-center rounded-full font-display text-lg font-bold ${avatarTone[q.tone]}`}
                  >
                    {q.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block font-display font-bold">{q.name}</span>
                    <span className="block text-sm text-ink-faint">{q.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------- Visit CTA -- */

function VisitCta() {
  const steps = [
    { n: "1", title: "Say hello", body: "Send a quick enquiry with a little about your child." },
    { n: "2", title: "Come and visit", body: "Look around, meet the team, and get a feel for the place." },
    { n: "3", title: "Join the family", body: "Settle in gently, at your child's own pace." },
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24">
      <Reveal>
        <div className="overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-sun-soft via-coral-soft to-sky-soft px-7 py-14 sm:px-12 sm:py-16">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-balance font-display text-4xl font-bold sm:text-5xl">
              Come and see us for yourself
            </h2>
            <p className="mt-4 text-lg text-ink-soft">
              The best way to know if Rihana is right for your family is to
              visit. We&rsquo;d love to show you around.
            </p>
          </div>

          <ol className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <li
                key={s.n}
                className="rounded-2xl bg-card/70 p-5 text-center backdrop-blur-sm"
              >
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-leaf font-display text-lg font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-3 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <CtaLink href="/enquire" className="text-lg">
              Book a visit <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </CtaLink>
            <CtaLink href="/visit" variant="outline" className="text-lg">
              Find us
            </CtaLink>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
