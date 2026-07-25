import type { Metadata } from "next";
import { ArrowRight, Check, Clock, Users } from "lucide-react";

import { CtaLink, Eyebrow } from "@/components/marketing/brand";
import { Photo } from "@/components/marketing/photo";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Our programs — ages 1 to 5",
  description:
    "Three age groups at Rihana Montessori Academy in Maadi: Sunflowers (1–2), Olives (2–4) and Cedars (4–5). Learning through play, in small, caring groups.",
};

const ROOMS = [
  {
    pill: "Toddlers",
    name: "Sunflowers",
    age: "1–2 years",
    hours: "8am – 2pm",
    ratio: "Small toddler groups",
    photo: "/marketing/music.jpg",
    alt: "Toddlers playing musical instruments with an educator",
    intro:
      "Those first steps away from home, held gently. Sunflowers is all about feeling safe, warm and loved while the world gets a little bigger.",
    learn: [
      "Settling in at your child's own pace",
      "Sensory play, songs and rhymes",
      "First words and lots of cuddles",
      "Gentle, predictable daily routines",
    ],
    tone: "sun",
  },
  {
    pill: "Preschool",
    name: "Olives",
    age: "2–4 years",
    hours: "8am – 3pm",
    ratio: "Caring small groups",
    photo: "/marketing/art.jpg",
    alt: "Preschoolers painting together at a table",
    intro:
      "Little friendships bloom here. Olives is busy, curious and joyfully messy — with plenty of art, stories and pretend play.",
    learn: [
      "Sharing, turn-taking and kindness",
      "Imaginative and role play",
      "Art, music and story time",
      "Gentle support with potty training",
    ],
    tone: "leaf",
  },
  {
    pill: "Pre-K",
    name: "Cedars",
    age: "4–5 years",
    hours: "8am – 4pm",
    ratio: "School-ready groups",
    photo: "/marketing/reading.jpg",
    alt: "An educator reading a story to a group of children",
    intro:
      "Getting ready for big school, with confidence. Cedars builds early literacy and numeracy through projects, play and lots of encouragement.",
    learn: [
      "Early letters, sounds and numbers",
      "Confidence and independence",
      "Listening, focus and teamwork",
      "A gentle bridge to primary school",
    ],
    tone: "sky",
  },
] as const;

const toneClasses = {
  sun: "bg-sun-soft text-warning",
  leaf: "bg-leaf-soft text-leaf-dark",
  sky: "bg-sky-soft text-sky",
} as const;

export default function ProgramsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Eyebrow>Our programs</Eyebrow>
        <h1 className="mt-2 text-balance font-display text-4xl font-bold sm:text-5xl">
          A room for every age
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Your child grows through three groups, each with its own gentle rhythm
          and a familiar key person who knows them by name.
        </p>
      </Reveal>

      <div className="mt-16 space-y-16">
        {ROOMS.map((room, i) => (
          <Reveal key={room.name}>
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <Photo
                  src={room.photo}
                  alt={room.alt}
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="aspect-[4/3] rounded-[2.5rem] border border-ink/10 shadow-pin-lg"
                />
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${toneClasses[room.tone]}`}>
                  {room.pill}
                </span>
                <h2 className="mt-3 font-display text-3xl font-bold">{room.name}</h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-bold text-ink-faint">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" /> {room.age}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" /> {room.hours}
                  </span>
                  <span>{room.ratio}</span>
                </div>
                <p className="mt-4 text-lg text-ink-soft">{room.intro}</p>
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {room.learn.map((line) => (
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
            Not sure which room is right?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">
            Come and visit — we&rsquo;ll help you find the perfect fit for your
            child and answer every question.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <CtaLink href="/enquire" className="text-lg">
              Book a visit <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </CtaLink>
            <CtaLink href="/about" variant="outline" className="text-lg">
              About us
            </CtaLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
