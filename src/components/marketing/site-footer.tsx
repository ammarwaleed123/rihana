import Image from "next/image";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { CtaLink } from "@/components/marketing/brand";

/**
 * Public site footer.
 *
 * Contact details are the point of a nursery footer — a parent deciding whether
 * to visit wants the address, the hours and a phone number without hunting. The
 * quiet "Staff login" sits here rather than in the header, where it would just
 * confuse prospective families.
 *
 * Placeholder contact details for now; the nursery's real address and number go
 * in when they confirm them.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink/10 bg-paper-deep sm:mt-24">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-9 px-5 py-11 sm:gap-10 sm:py-14 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <Image
            src="/logo.png"
            alt="Rihana Montessori Academy"
            width={507}
            height={492}
            className="h-16 w-auto sm:h-20"
          />
          <p className="mt-3 max-w-md text-sm text-ink-soft">
            A warm, playful place for little ones to learn through play — with
            photos kept safely for family only.
          </p>
        </div>

        <FooterCol title="Explore">
          <FooterLink href="/">Home</FooterLink>
          <FooterLink href="/programs">Programs</FooterLink>
          <FooterLink href="/about">About us</FooterLink>
          <FooterLink href="/visit">Visit us</FooterLink>
        </FooterCol>

        <FooterCol title="Families">
          <FooterLink href="/enquire">Enquire about a place</FooterLink>
          <FooterLink href="/signin">Parent login</FooterLink>
          <FooterLink href="/signin">Staff login</FooterLink>
        </FooterCol>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
            Visit
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-soft">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-leaf" />
              <span>12 Garden Street, Maadi, Cairo</span>
            </li>
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-leaf" />
              <span>Sunday – Thursday · 8am – 4pm</span>
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-leaf" />
              <a href="tel:+201000000000" className="hover:text-leaf-dark">
                +20 100 000 0000
              </a>
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-leaf" />
              <a href="mailto:hello@rihana.com" className="hover:text-leaf-dark">
                hello@rihana.com
              </a>
            </li>
          </ul>
          <CtaLink href="/enquire" className="mt-5 px-5 py-2.5 text-sm">
            Book a visit
          </CtaLink>
        </div>
      </div>

      <div className="border-t border-ink/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-ink-faint">
          <p>© {new Date().getFullYear()} Rihana Montessori Academy. Made with care.</p>
          <p>Photos of children are private and shared only with their families.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
        {title}
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-soft transition-colors hover:text-leaf-dark">
        {children}
      </Link>
    </li>
  );
}
