import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * The Rihana Montessori Academy logo, for the app headers (portal, admin, auth).
 *
 * The marketing site has its own `Wordmark`; this one links to wherever the app
 * zone's home is. Same image, sized down for the utilitarian header.
 */
export function BrandLogo({
  href,
  imgClassName = "h-12 w-auto sm:h-14",
}: {
  href: string;
  imgClassName?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Rihana Montessori Academy — home"
      className="inline-flex items-center"
    >
      <Image
        src="/logo.png"
        alt="Rihana Montessori Academy"
        width={507}
        height={492}
        priority
        className={cn(imgClassName)}
      />
    </Link>
  );
}
