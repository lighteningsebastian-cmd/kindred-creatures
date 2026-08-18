"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { PLACEMENT, type GarmentSide } from "@/lib/garments";
import { plateCentre, zoomScale } from "@/lib/print-zoom";
import type { Shot } from "@/lib/garment-shots";
import type { ProductSlug } from "@/lib/products";

/**
 * The print, as large as this screen can honestly show it.
 *
 * FRAMES THE PLATE, NOT THE PHOTOGRAPH, and that is the whole design. A modal
 * showing the whole hoodie at 92% of screen height puts the chest badge at
 * about 105px, against the 67px it already is on the card — all this machinery
 * bought for 1.6x, still unreadable. The scale and the origin both come from
 * lib/print-zoom.ts; see the note there for why one constant serves both sides
 * and every screen size.
 *
 * WHY THERE IS NO HYDRATION GUARD ON useReducedMotion, when Reveal.tsx has one
 * and its comment argues at length that it is not optional. That guard exists
 * because Reveal renders on the SERVER, where the hook answers null while a
 * browser with Reduce Motion on answers true; branching on the first render
 * left the server's `opacity: 0` stuck on elements that would never animate,
 * and the whole page below the hero went invisible for exactly the people who
 * asked for less motion. This component is only ever mounted by a click, which
 * cannot happen before hydration, so there is no server render to disagree
 * with. The guard would be dead code here rather than safety. If this is ever
 * rendered unconditionally, the guard has to come back with it.
 */
export function PrintLightbox({
  shot,
  slug,
  onClose,
}: {
  shot: Shot;
  /** Whose placement to use, for the view being enlarged. */
  slug: ProductSlug;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const reducedMotion = useReducedMotion() ?? false;

  const placement = shot.printed
    ? PLACEMENT[slug][shot.view as GarmentSide]
    : null;

  const scale = zoomScale({
    plateWidthPct: placement?.width ?? null,
    boxWidth,
    photoSourceWidth: shot.sourceWidth,
  });

  // Centre of the frame when there is nothing to frame on: fleece and profile
  // carry no plate, so they open at life size on the middle of the picture.
  const origin =
    placement && shot.plateAspect
      ? plateCentre(placement, shot.aspect, shot.plateAspect)
      : { x: 50, y: 50 };

  /**
   * Measure the box, because the scale is a fraction OF the box.
   *
   * Layout effect rather than effect so the first painted frame is already
   * framed; with a plain effect the lightbox paints once at life size and then
   * jumps, which reads as a bug rather than an animation.
   */
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setBoxWidth(box.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // The dialog holds exactly one control, so trapping focus is just
      // refusing to let Tab leave. Anything more elaborate would be machinery
      // for a focus ring that has nowhere else to go.
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={shot.alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-md px-3 py-2 text-xs uppercase tracking-[0.12em] text-base/80 transition-colors hover:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary"
      >
        Close
      </button>

      <div
        ref={boxRef}
        onClick={(event) => event.stopPropagation()}
        // Landscape when framing a print, because the frame is a crop of a
        // garment rather than a garment. At life size it keeps the
        // photograph's own shape, so a fleece detail is not letterboxed.
        style={{ aspectRatio: placement ? "1.2" : String(shot.aspect) }}
        className="relative h-[88vh] max-w-full overflow-hidden rounded bg-surface"
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: `${origin.x}% ${origin.y}%`,
            transition: reducedMotion
              ? "none"
              : "transform 320ms cubic-bezier(0.2, 0.7, 0.3, 1)",
          }}
        >
          {/*
            The photograph's own shape, centred. Same nested-box rule as
            GarmentShots: plate placement is a percentage of the PHOTOGRAPH, so
            a box of any other shape letterboxes the picture while the plate
            keeps measuring against the box, and the print lands on the
            parchment beside the garment.
          */}
          <div
            className="absolute left-1/2 top-1/2 isolate h-full max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 bg-surface"
            style={{ aspectRatio: shot.aspect }}
          >
            <Image
              src={shot.url}
              alt={shot.alt}
              fill
              // The photograph is drawn at up to MAX_UPSCALE times the box, so
              // asking for the box's own width would fetch a candidate several
              // times too small and the fabric would be softer than the
              // arithmetic promises. 100vw takes the largest candidate there
              // is; the optimizer will not invent pixels past the file's own
              // 1120 to 1400, which is exactly the ceiling zoomScale enforces.
              sizes="100vw"
              className="object-cover mix-blend-multiply"
            />

            {placement && shot.plateUrl ? (
              <div
                className="absolute"
                style={{
                  top: `${placement.top}%`,
                  left: `${placement.left}%`,
                  width: `${placement.width}%`,
                }}
              >
                {/* The plate is a transparent PNG, so the garment colour shows
                    through it exactly as ink does on fabric. Redrawn crisp from
                    its own source at any zoom, which is why only the fabric
                    behind it softens. */}
                <Image
                  src={shot.plateUrl}
                  alt=""
                  width={900}
                  height={1125}
                  sizes="60vw"
                  className="h-auto w-full"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
