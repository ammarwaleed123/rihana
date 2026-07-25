import Image from "next/image";

import { cn } from "@/lib/cn";

/**
 * A framed marketing photo.
 *
 * Wraps next/image in fill mode inside an aspect-ratio box, so photos are
 * optimised, lazy-loaded, and never cause layout shift. Pass the aspect ratio
 * and any rounding/shadow through `className`; `sizes` should reflect how wide
 * the image actually renders so the browser fetches the right resolution.
 *
 * These photos live in /public/marketing and are free-license placeholders — the
 * nursery swaps in its own once it has them (see public/marketing/README.md).
 */
export function Photo({
  src,
  alt,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-paper-deep", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
