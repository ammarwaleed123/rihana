import type { Locale } from "./config";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  OWNER-SUPPLIED CONTENT — THE ONLY FILE THAT NEEDS REAL DATA BEFORE LAUNCH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Everything in this file is currently a PLACEHOLDER and must be replaced with
 * the nursery's real details. It is deliberately separated from the phrase
 * dictionaries because this is *facts about the business* (address, hours, room
 * names, fees, real parent quotes) rather than UI wording — the owner supplies
 * it, and it is the only thing standing between the site and going live.
 *
 * Each entry carries both languages. Where a value is genuinely identical in
 * both (a phone number, an email address), it is stored once as a plain string.
 *
 * ⚠️  BEFORE LAUNCH, VERIFY EVERY CLAIM IS TRUE. The copy asserts qualified
 * staff, paediatric first-aid training, freshly prepared meals and outdoor
 * space. If any of these is not accurate, change the wording in the dictionary
 * — do not ship a claim the nursery cannot stand behind.
 *
 * Photos are NOT here: they are files. Drop the nursery's own images over
 * public/marketing/{hero,care,reading,art,music,movement,calm,play}.jpg using
 * the same filenames and no code changes are needed. See
 * public/marketing/README.md.
 */

/** A value that differs between languages. */
export type Bilingual = { en: string; ar: string };

export function pick(value: Bilingual | string, locale: Locale): string {
  return typeof value === "string" ? value : value[locale];
}

/* ---------------------------------------------------------------- contact -- */

export const CONTACT = {
  // TODO(owner): real street address.
  address: {
    en: "12 Garden Street, Maadi, Cairo",
    ar: "12 شارع الحديقة، المعادي، القاهرة",
  } satisfies Bilingual,

  // TODO(owner): real opening days and hours.
  hours: {
    en: "Sunday – Thursday · 8am – 4pm",
    ar: "الأحد – الخميس · 8 ص – 4 م",
  } satisfies Bilingual,

  // TODO(owner): real phone number. `tel` is the dialable form, `display` is
  // what a visitor reads — keep them consistent.
  phone: { tel: "+201000000000", display: "+20 100 000 0000" },

  // TODO(owner): real email address.
  email: "hello@rihana.com",

  // TODO(owner): the exact Google Maps location (or a plus code).
  mapsQuery: "Maadi,Cairo,Egypt",

  city: { en: "Maadi, Cairo", ar: "المعادي، القاهرة" } satisfies Bilingual,

  /** Machine-readable hours for the ChildCare structured data. */
  openingHoursSchema: "Su-Th 08:00-16:00",
} as const;

/* ------------------------------------------------------------------ rooms -- */

export type Room = {
  key: string;
  pill: Bilingual;
  name: Bilingual;
  age: Bilingual;
  hours: Bilingual;
  ratio: Bilingual;
  photo: string;
  alt: Bilingual;
  blurb: Bilingual;
  intro: Bilingual;
  learn: { en: string[]; ar: string[] };
  tone: "sun" | "leaf" | "sky";
};

// TODO(owner): confirm the real room names, age ranges and daily hours.
export const ROOMS: Room[] = [
  {
    key: "sunflowers",
    pill: { en: "Toddlers", ar: "الصغار" },
    name: { en: "Sunflowers", ar: "عبّاد الشمس" },
    age: { en: "1–2 years", ar: "من سنة إلى سنتين" },
    hours: { en: "8am – 2pm", ar: "8 ص – 2 م" },
    ratio: { en: "Small toddler groups", ar: "مجموعات صغيرة للصغار" },
    photo: "/marketing/music.jpg",
    alt: {
      en: "Toddlers playing musical instruments with an educator",
      ar: "أطفال صغار يعزفون على آلات موسيقية مع معلّمة",
    },
    blurb: {
      en: "First steps away from home: songs, sensory play and lots of cuddles.",
      ar: "أولى الخطوات بعيدًا عن البيت: أغانٍ ولعب حسّي وكثير من الأحضان.",
    },
    intro: {
      en: "Those first steps away from home, held gently. Sunflowers is all about feeling safe, warm and loved while the world gets a little bigger.",
      ar: "أولى الخطوات بعيدًا عن البيت، بيدٍ حانية. عبّاد الشمس مكان للشعور بالأمان والدفء والحب بينما يتّسع العالم قليلًا.",
    },
    learn: {
      en: [
        "Settling in at your child's own pace",
        "Sensory play, songs and rhymes",
        "First words and lots of cuddles",
        "Gentle, predictable daily routines",
      ],
      ar: [
        "تأقلم على مهل طفلك",
        "لعب حسّي وأغانٍ وأناشيد",
        "أولى الكلمات وكثير من الأحضان",
        "روتين يومي لطيف ومألوف",
      ],
    },
    tone: "sun",
  },
  {
    key: "olives",
    pill: { en: "Preschool", ar: "ما قبل المدرسة" },
    name: { en: "Olives", ar: "الزيتون" },
    age: { en: "2–4 years", ar: "من سنتين إلى 4 سنوات" },
    hours: { en: "8am – 3pm", ar: "8 ص – 3 م" },
    ratio: { en: "Caring small groups", ar: "مجموعات صغيرة وحانية" },
    photo: "/marketing/art.jpg",
    alt: {
      en: "Preschoolers painting together at a table",
      ar: "أطفال ما قبل المدرسة يرسمون معًا على طاولة",
    },
    blurb: {
      en: "Sharing, stories and messy art as little friendships begin.",
      ar: "مشاركة وقصص وفنون ممتعة مع بداية الصداقات الصغيرة.",
    },
    intro: {
      en: "Little friendships bloom here. Olives is busy, curious and joyfully messy — with plenty of art, stories and pretend play.",
      ar: "هنا تزهر الصداقات الصغيرة. الزيتون قاعة نشِطة وفضولية ومليئة بالمرح — مع الكثير من الفن والقصص واللعب التخيّلي.",
    },
    learn: {
      en: [
        "Sharing, turn-taking and kindness",
        "Imaginative and role play",
        "Art, music and story time",
        "Gentle support with potty training",
      ],
      ar: [
        "المشاركة وتبادل الأدوار واللطف",
        "اللعب التخيّلي وتمثيل الأدوار",
        "الفن والموسيقى ووقت القصة",
        "مساندة لطيفة في التدريب على الحمّام",
      ],
    },
    tone: "leaf",
  },
  {
    key: "cedars",
    pill: { en: "Pre-K", ar: "تمهيدي" },
    name: { en: "Cedars", ar: "الأرز" },
    age: { en: "4–5 years", ar: "من 4 إلى 5 سنوات" },
    hours: { en: "8am – 4pm", ar: "8 ص – 4 م" },
    ratio: { en: "School-ready groups", ar: "مجموعات الاستعداد للمدرسة" },
    photo: "/marketing/reading.jpg",
    alt: {
      en: "An educator reading a story to a group of children",
      ar: "معلّمة تقرأ قصة لمجموعة من الأطفال",
    },
    blurb: {
      en: "Early letters and numbers, getting ready for big school.",
      ar: "الحروف والأرقام الأولى، واستعداد للمدرسة الكبيرة.",
    },
    intro: {
      en: "Getting ready for big school, with confidence. Cedars builds early literacy and numeracy through projects, play and lots of encouragement.",
      ar: "استعداد للمدرسة الكبيرة، بثقة. تبني قاعة الأرز مهارات القراءة والحساب المبكرة من خلال المشروعات واللعب والكثير من التشجيع.",
    },
    learn: {
      en: [
        "Early letters, sounds and numbers",
        "Confidence and independence",
        "Listening, focus and teamwork",
        "A gentle bridge to primary school",
      ],
      ar: [
        "الحروف والأصوات والأرقام الأولى",
        "الثقة بالنفس والاعتماد على الذات",
        "الإنصات والتركيز والعمل الجماعي",
        "جسر لطيف نحو المرحلة الابتدائية",
      ],
    },
    tone: "sky",
  },
];

/* -------------------------------------------------------------------- FAQ -- */

// TODO(owner): confirm every answer, and add the real fees answer.
export const FAQ: { q: Bilingual; a: Bilingual }[] = [
  {
    q: { en: "What ages do you take?", ar: "ما الأعمار التي تستقبلونها؟" },
    a: {
      en: "We welcome children from 1 to 5 years, across three age groups: Sunflowers (1–2), Olives (2–4) and Cedars (4–5).",
      ar: "نرحّب بالأطفال من سنة إلى 5 سنوات، في ثلاث مجموعات عمرية: عبّاد الشمس (1–2)، والزيتون (2–4)، والأرز (4–5).",
    },
  },
  {
    q: { en: "What are your hours?", ar: "ما مواعيد العمل؟" },
    a: {
      en: "We're open Sunday to Thursday. Sessions run from 8am, finishing at 2pm, 3pm or 4pm depending on your child's group.",
      ar: "نعمل من الأحد إلى الخميس. يبدأ اليوم الساعة 8 صباحًا وينتهي في 2 أو 3 أو 4 عصرًا حسب مجموعة طفلك.",
    },
  },
  {
    q: { en: "Do you provide meals?", ar: "هل توفّرون وجبات؟" },
    a: {
      en: "Yes — fresh, balanced meals and snacks are prepared on site each day. Let us know about any allergies or dietary needs.",
      ar: "نعم — تُحضَّر وجبات ووجبات خفيفة طازجة ومتوازنة في المكان يوميًا. أخبرنا بأي حساسية أو احتياجات غذائية خاصة.",
    },
  },
  {
    q: { en: "How does settling in work?", ar: "كيف تتم فترة التأقلم؟" },
    a: {
      en: "Gently, and at your child's pace. We build up gradually with a familiar key person, so your little one feels safe from the start.",
      ar: "بلطف، وعلى مهل طفلك. نتدرّج خطوة بخطوة مع معلّمة مرافقة ثابتة، ليشعر صغيرك بالأمان من البداية.",
    },
  },
  {
    q: { en: "What are the fees?", ar: "ما قيمة المصروفات؟" },
    a: {
      en: "Fees depend on your child's group and days. We'll share the current fees and availability when you enquire or visit.",
      ar: "تعتمد المصروفات على مجموعة طفلك وعدد الأيام. سنوافيك بالمصروفات الحالية والأماكن المتاحة عند الاستفسار أو الزيارة.",
    },
  },
  {
    q: { en: "How do I enrol?", ar: "كيف أسجّل طفلي؟" },
    a: {
      en: "Send us an enquiry, come for a visit, and — when you're ready — we'll help your child settle in. That's it.",
      ar: "أرسل لنا استفسارًا، وتعالَ لزيارتنا، وعندما تكون جاهزًا سنساعد طفلك على التأقلم. الأمر بهذه البساطة.",
    },
  },
];

/* ----------------------------------------------------------- testimonials -- */

// TODO(owner): replace with real, permission-granted parent quotes. Written
// consent is required before publishing a parent's name — even an initial.
export const TESTIMONIALS: {
  quote: Bilingual;
  name: Bilingual;
  role: Bilingual;
  tone: "coral" | "sky" | "sun";
}[] = [
  {
    quote: {
      en: "She runs in every morning without looking back. The staff genuinely know and love her.",
      ar: "تجري إلى الداخل كل صباح دون أن تلتفت. الفريق يعرفها ويحبّها بصدق.",
    },
    name: { en: "Mona A.", ar: "منى ع." },
    role: { en: "mum in Sunflowers", ar: "والدة في عبّاد الشمس" },
    tone: "coral",
  },
  {
    quote: {
      en: "Warm, safe and organised. Knowing exactly who can collect him put my mind completely at ease.",
      ar: "دافئ وآمن ومنظّم. معرفتي بالضبط بمن يمكنه اصطحابه أراحت بالي تمامًا.",
    },
    name: { en: "Khaled R.", ar: "خالد ر." },
    role: { en: "dad in Cedars", ar: "والد في الأرز" },
    tone: "sky",
  },
  {
    quote: {
      en: "The meals, the garden, the little art projects — it feels like a home away from home.",
      ar: "الوجبات والحديقة والمشروعات الفنية الصغيرة — المكان أشبه ببيت ثانٍ.",
    },
    name: { en: "Salma H.", ar: "سلمى ح." },
    role: { en: "mum in Olives", ar: "والدة في الزيتون" },
    tone: "sun",
  },
];
