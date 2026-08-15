"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A drawn signature.
 *
 * Used on accident records, and nowhere else in the app — this is the one place
 * where what is stored has to point at a person rather than an account, so a
 * tick box would not do.
 *
 * Three things drive the implementation:
 *
 *   - It is drawn with a finger, on a phone, by someone standing up. Pointer
 *     events cover pen, touch and mouse in one path, and `touch-action: none`
 *     is what stops the page scrolling away underneath the stroke.
 *   - Strokes are kept as normalised points rather than as pixels on the
 *     canvas. Rotating a phone resizes the element, and a canvas resize wipes
 *     its backing store — keeping the geometry means the signature survives
 *     being turned sideways instead of vanishing mid-form.
 *   - What is exported is redrawn at a fixed size onto white, so the stored
 *     image does not depend on the width of the phone that produced it.
 *
 * There is no no-JavaScript path here. The rest of the report degrades to a
 * plain form; a handwritten signature cannot, and pretending otherwise would
 * mean a submit button that silently produced an unsigned record.
 */

/** Normalised to 0–1 on both axes, so geometry outlives any resize. */
type Point = { x: number; y: number };
type Stroke = Point[];

const EXPORT_WIDTH = 600;
const EXPORT_HEIGHT = 200;
const INK = "#1f2933";

export function SignaturePad({
  name,
  label,
  hint,
  clearLabel,
  emptyLabel,
  onChange,
  disabled = false,
}: {
  /** Form field carrying the PNG data URL. */
  name: string;
  label: string;
  hint?: string;
  clearLabel: string;
  /** Shown inside the box while it is untouched. */
  emptyLabel: string;
  onChange?: (hasInk: boolean) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [dataUrl, setDataUrl] = useState("");

  const hasInk = dataUrl !== "";

  /** Repaint every stored stroke at the element's current size. */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Assigning width/height clears the canvas, so this must happen before the
    // strokes are painted rather than after.
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.clearRect(0, 0, width, height);
    paint(context, strokesRef.current, width, height, 2.5);
  }, []);

  useEffect(() => {
    redraw();

    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  /** Render at a fixed size onto white — never the device's pixel dimensions. */
  const exportSignature = useCallback(() => {
    if (strokesRef.current.length === 0) {
      setDataUrl("");
      onChange?.(false);
      return;
    }

    const off = document.createElement("canvas");
    off.width = EXPORT_WIDTH;
    off.height = EXPORT_HEIGHT;
    const context = off.getContext("2d");
    if (!context) return;

    // Opaque white, not transparency: the server flattens anyway, and a
    // transparent PNG shown on a dark background is an invisible signature.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    paint(context, strokesRef.current, EXPORT_WIDTH, EXPORT_HEIGHT, 3);

    setDataUrl(off.toDataURL("image/png"));
    onChange?.(true);
  }, [onChange]);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.preventDefault();
    // Capture keeps the stroke coming even when the finger slides outside the
    // box, which on a small screen it constantly does.
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, [pointFrom(event)]];
    redraw();
  }

  function extend(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const strokes = strokesRef.current;
    strokes[strokes.length - 1]?.push(pointFrom(event));
    redraw();
  }

  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // Exporting once per stroke rather than per movement: a data URL is a
    // base64 string of the whole image, and building one on every pointermove
    // is how a signature box starts stuttering on a mid-range phone.
    exportSignature();
  }

  function clear() {
    strokesRef.current = [];
    redraw();
    setDataUrl("");
    onChange?.(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="block text-sm font-bold text-ink">{label}</span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="text-sm font-bold text-ink-soft underline underline-offset-2 hover:text-leaf disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
        >
          {clearLabel}
        </button>
      </div>

      {hint ? <p className="text-sm text-ink-faint">{hint}</p> : null}

      <div className="relative">
        <canvas
          ref={canvasRef}
          // `touch-none` is load-bearing: without it the first downward stroke
          // scrolls the page instead of drawing a line.
          className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-ink/25 bg-card"
          onPointerDown={start}
          onPointerMove={extend}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label={label}
        />

        {hasInk ? null : (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-ink-faint">
            {emptyLabel}
          </p>
        )}
      </div>

      <input type="hidden" name={name} value={dataUrl} />
    </div>
  );
}

/** Paint strokes at a given size. Shared by the on-screen and exported canvas. */
function paint(
  context: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
  lineWidth: number,
) {
  context.strokeStyle = INK;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;

    context.beginPath();

    // A single tap is a dot, not a zero-length line — without this a full stop
    // or a dotted 'i' disappears.
    if (stroke.length === 1) {
      const only = stroke[0]!;
      context.arc(
        only.x * width,
        only.y * height,
        lineWidth / 2,
        0,
        Math.PI * 2,
      );
      context.fillStyle = INK;
      context.fill();
      continue;
    }

    context.moveTo(stroke[0]!.x * width, stroke[0]!.y * height);
    for (const point of stroke.slice(1)) {
      context.lineTo(point.x * width, point.y * height);
    }
    context.stroke();
  }
}
