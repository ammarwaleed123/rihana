"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Reveal-on-scroll.
 *
 * Adds `is-visible` the first time the element enters the viewport, which the
 * CSS in globals.css turns into a short fade-and-rise. The hidden starting state
 * only exists when JS has run (html.reveal-ready), so crawlers and no-JS
 * visitors see everything — and reduced-motion visitors skip the animation
 * entirely (also handled in CSS).
 *
 * `delay` staggers a group; keep it to ~8 items and ~80ms steps so the last one
 * doesn't feel laggy.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Belt and braces: if it's already on screen at mount, or the browser has
    // no observer, show it immediately rather than waiting for a scroll.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        }
      },
      // Trigger a touch before fully in view (~top 88%), so it reads as content
      // arriving rather than popping in after it's already been read.
      { threshold: 0.1, rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
