import type { CSSProperties } from "react";

/**
 * Ambient falling toys — the animated background for the public site.
 *
 * A fixed, decorative layer behind the content: balloons, stars, blocks and
 * kites drift down the viewport forever, showing through the paper gaps between
 * the opaque content cards. Pure CSS (see `.falling-toy` in globals.css), so it
 * costs no JavaScript, and it's removed entirely for anyone who prefers reduced
 * motion. `aria-hidden` because it carries no meaning.
 *
 * The values are fixed (not random) so the server and client render the same
 * markup — a random layout would hydrate-mismatch.
 */

type Shape = "balloon" | "star" | "block" | "kite" | "cloud" | "ball" | "heart";

type Toy = {
  shape: Shape;
  left: string;
  size: number;
  dur: number;
  delay: number;
  spin: number;
  drift: string;
  op: number;
  color: string;
};

const TOYS: Toy[] = [
  { shape: "balloon", left: "4%", size: 40, dur: 21, delay: 0, spin: 18, drift: "26px", op: 0.4, color: "var(--color-coral)" },
  { shape: "star", left: "14%", size: 24, dur: 16, delay: 5, spin: 220, drift: "-20px", op: 0.5, color: "var(--color-sun)" },
  { shape: "kite", left: "23%", size: 38, dur: 24, delay: 11, spin: 30, drift: "34px", op: 0.32, color: "var(--color-sky)" },
  { shape: "block", left: "33%", size: 30, dur: 19, delay: 2, spin: 140, drift: "-24px", op: 0.32, color: "var(--color-leaf)" },
  { shape: "cloud", left: "44%", size: 46, dur: 27, delay: 8, spin: 8, drift: "18px", op: 0.4, color: "var(--color-sky)" },
  { shape: "heart", left: "52%", size: 24, dur: 17, delay: 14, spin: 200, drift: "-16px", op: 0.4, color: "var(--color-coral)" },
  { shape: "star", left: "61%", size: 20, dur: 15, delay: 6, spin: 260, drift: "22px", op: 0.45, color: "var(--color-sun)" },
  { shape: "balloon", left: "70%", size: 34, dur: 22, delay: 12, spin: -16, drift: "-28px", op: 0.35, color: "var(--color-sky)" },
  { shape: "ball", left: "78%", size: 28, dur: 18, delay: 3, spin: 300, drift: "20px", op: 0.32, color: "var(--color-sun)" },
  { shape: "block", left: "86%", size: 26, dur: 20, delay: 9, spin: -120, drift: "-22px", op: 0.3, color: "var(--color-coral)" },
  { shape: "star", left: "92%", size: 22, dur: 14, delay: 16, spin: 240, drift: "16px", op: 0.45, color: "var(--color-sun)" },
  { shape: "kite", left: "9%", size: 30, dur: 23, delay: 18, spin: -24, drift: "28px", op: 0.3, color: "var(--color-coral)" },
];

export function FallingToys() {
  return (
    <div className="falling-layer" aria-hidden>
      {TOYS.map((t, i) => (
        <span
          key={i}
          className="falling-toy"
          style={
            {
              "--toy-left": t.left,
              "--toy-dur": `${t.dur}s`,
              "--toy-delay": `${t.delay}s`,
              "--toy-spin": `${t.spin}deg`,
              "--toy-drift": t.drift,
              "--toy-op": t.op,
              "--toy-color": t.color,
              width: t.size,
              height: t.size,
            } as CSSProperties
          }
        >
          <ToyShape shape={t.shape} />
        </span>
      ))}
    </div>
  );
}

function ToyShape({ shape }: { shape: Shape }) {
  const common = { width: "100%", height: "100%", "aria-hidden": true } as const;
  switch (shape) {
    case "balloon":
      return (
        <svg viewBox="0 0 24 34" {...common}>
          <ellipse cx="12" cy="11" rx="9" ry="11" fill="currentColor" />
          <path d="M12 22c0 3-2 4-2 6s2 2 2 4" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M10.5 20.5 12 23l1.5-2.5z" fill="currentColor" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path
            d="M12 2l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 16.9 6.1 20.3l1.7-6.6L2.6 8.8l6.8-.5z"
            fill="currentColor"
          />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path
            d="M12 21s-8-4.6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 11c0 5.4-8 10-8 10z"
            fill="currentColor"
          />
        </svg>
      );
    case "block":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
          <rect x="8" y="8" width="8" height="8" rx="2" fill="var(--color-card)" opacity="0.55" />
        </svg>
      );
    case "kite":
      return (
        <svg viewBox="0 0 24 34" {...common}>
          <path d="M12 1 21 12 12 23 3 12z" fill="currentColor" />
          <path d="M12 1 12 23M3 12 21 12" stroke="var(--color-card)" strokeWidth="1" opacity="0.5" />
          <path d="M12 23c-1 3 1 4 0 7" stroke="currentColor" strokeWidth="1.3" fill="none" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 32 20" {...common}>
          <path
            d="M8 18a6 6 0 0 1-1-11.9A7 7 0 0 1 21 6.5 5.5 5.5 0 0 1 24 18z"
            fill="currentColor"
          />
        </svg>
      );
    case "ball":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="M4 10c5 2 11 2 16 0M6 16c4 1 8 1 12 0" stroke="var(--color-card)" strokeWidth="1.2" fill="none" opacity="0.6" />
        </svg>
      );
  }
}
