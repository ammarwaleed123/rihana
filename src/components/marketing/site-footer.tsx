import Image from "next/image";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { CtaLink } from "@/components/marketing/brand";
import { localePath, type Locale } from "@/lib/i18n/config";
import { CONTACT, pick } from "@/lib/i18n/content";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Public site footer.
 *
 * Contact details are the point of a nursery footer — a parent deciding whether
 * to visit wants the address, the hours and a phone number without hunting. The
 * quiet "Staff login" sits here rather than in the header, where it would just
 * confuse prospective families.
 *
 * The contact details come from src/lib/i18n/content.ts, which is the single
 * file the owner's real address, hours, phone and email go into.
 */
export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const to = (path: string) => localePath(locale, path);

  return (
    <footer className="mt-16 border-t border-ink/10 bg-paper-deep sm:mt-24">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-9 px-5 py-11 sm:gap-10 sm:py-14 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <Image
            src="/logo.png"
            alt={dict.meta.siteName}
            width={507}
            height={492}
            className="h-16 w-auto sm:h-20"
          />
          <p className="mt-3 max-w-md text-sm text-ink-soft">{dict.footer.blurb}</p>
        </div>

        <FooterCol title={dict.footer.explore}>
          <FooterLink href={to("/")}>{dict.nav.home}</FooterLink>
          <FooterLink href={to("/programs")}>{dict.nav.programs}</FooterLink>
          <FooterLink href={to("/about")}>{dict.nav.aboutLong}</FooterLink>
          <FooterLink href={to("/visit")}>{dict.nav.visit}</FooterLink>
        </FooterCol>

        <FooterCol title={dict.footer.families}>
          <FooterLink href={to("/enquire")}>
            {dict.footer.enquireAboutPlace}
          </FooterLink>
          {/* Sign-in is shared by both languages and lives outside the
              localized tree. */}
          <FooterLink href="/signin">{dict.nav.parentLogin}</FooterLink>
          <FooterLink href="/signin">{dict.nav.staffLogin}</FooterLink>
        </FooterCol>

        <div>
          <h2 className="u-eyebrow font-display text-sm font-bold uppercase tracking-wide text-ink">
            {dict.footer.visitHeading}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-soft">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-leaf" />
              <span>{pick(CONTACT.address, locale)}</span>
            </li>
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-leaf" />
              <span>{pick(CONTACT.hours, locale)}</span>
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-leaf" />
              {/* A phone number is always read left-to-right, even inside an
                  RTL paragraph, so it is isolated with dir="ltr". */}
              <a
                href={`tel:${CONTACT.phone.tel}`}
                dir="ltr"
                className="hover:text-leaf-dark"
              >
                {CONTACT.phone.display}
              </a>
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-leaf" />
              <a
                href={`mailto:${CONTACT.email}`}
                dir="ltr"
                className="hover:text-leaf-dark"
              >
                {CONTACT.email}
              </a>
            </li>
          </ul>
          <CtaLink href={to("/enquire")} className="mt-5 px-5 py-2.5 text-sm">
            {dict.common.bookVisit}
          </CtaLink>
        </div>
      </div>

      <div className="border-t border-ink/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-ink-faint">
          <p>
            © {new Date().getFullYear()} {dict.meta.siteName}. {dict.footer.rights}
          </p>
          <p>{dict.footer.privacyNote}</p>
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
      <h2 className="u-eyebrow font-display text-sm font-bold uppercase tracking-wide text-ink">
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
