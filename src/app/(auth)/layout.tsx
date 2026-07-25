import { BrandLogo } from "@/components/brand-logo";

/**
 * Layout for the unauthenticated auth pages.
 *
 * Centred single-column card — these are the only pages a signed-out person can
 * reach behind /portal and /admin, and they are almost always opened on a phone.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="px-6 py-6">
        <BrandLogo href="/" imgClassName="h-16 w-auto" />
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-6 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-6 py-8 text-center text-sm text-ink-faint">
        Need help? Contact the nursery office.
      </footer>
    </div>
  );
}
