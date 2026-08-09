import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";

import { AuthLanguageSwitcher } from "./auth-language-switcher";
import { AuthLogo } from "./auth-logo";

/**
 * Layout for the unauthenticated auth pages.
 *
 * Centred single-column card — these are the only pages a signed-out person can
 * reach behind /portal and /admin, and they are almost always opened on a phone.
 *
 * The language here comes from the cookie rather than the URL (the proxy stamps
 * its header for the marketing site only), so a parent who chose Arabic sees an
 * Arabic sign-in page next time. The toggle is what a first-time visitor needs:
 * an invitation link arrives with no cookie at all, so it opens in English, and
 * without a switch there would be nothing an Arabic speaker could do about it.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/*
        Browser visitors can head back to the website via the logo; the installed
        app keeps it pointed at the portal so the app stays portal-only. See
        AuthLogo.
      */}
      <header className="flex items-center justify-between gap-4 px-6 py-6">
        <AuthLogo name={dict.meta.siteName} label={dict.meta.logoHome} />
        <AuthLanguageSwitcher locale={locale} />
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-6 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-6 py-8 text-center text-sm text-ink-faint">
        {dict.auth.needHelp}
      </footer>
    </div>
  );
}
