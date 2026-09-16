"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { placementFor, type GarmentSide } from "@/lib/garments";
import { plateCentre, zoomScale } from "@/lib/print-zoom";
import type { Shot } from "@/lib/garment-shots";
import type { ProductSlug } from "@/lib/products";

/**
 * The print, as large as this screen can honestly show it.
 *
 * FRAMES THE PLATE, NOT THE PHOTOGRAPH, and that is the whole design. A modal
 * showing the whole hoodie at 92% of screen height puts the chest badge at
 * about 105px, against the 67px it already is on the card, all this machinery
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
  const [box, setBox] = useState({ width: 0, height: 0 });
  const reducedMotion = useReducedMotion() ?? false;

  // The enlarged shot's own colourway, so the zoom frames the plate where it
  // is drawn on this photograph rather than where it sits on another shoot.
  const placement = shot.printed
    ? placementFor(slug, shot.colour, shot.view as GarmentSide)
    : null;

  /**
   * How wide the photograph is drawn before any scaling.
   *
   * THE PHOTOGRAPH IS NOT AS WIDE AS THE BOX and the difference is the whole
   * point of the landscape frame. The photo keeps its own shape and is height
   * constrained inside the box, so at 88vh on a 1280x800 screen an 845-wide
   * box holds a 563-wide photograph. Handing zoomScale the box's width instead
   * renders the print at 41% of the lightbox when 62% was asked for, which is
   * what shipped for about ten minutes before the browser said otherwise.
   */
  const photoWidth = Math.min(box.width, box.height * shot.aspect);
  const photoHeight = photoWidth / shot.aspect;

  const scale = zoomScale({
    plateWidthPct: placement?.width ?? null,
    photoWidth,
    boxWidth: box.width,
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
    const node = boxRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
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
        {/*
          The photograph, positioned so the PRINT is at the middle of the box,
          and scaled about that same point.

          THE ORIGIN IS A PERCENTAGE OF THE PHOTOGRAPH, so it has to be set on
          the photograph. Setting it on a wrapper that fills the box instead
          measures those percentages against the wrong width (the photo is 563
          wide in an 845 box), and the error is then multiplied by the scale.
          At 5.97x it framed the drawstring instead of the badge.

          Left and top place the print's centre on the box's centre; the origin
          then pins that same point through the scale. A view with no plate
          falls out of the same arithmetic as a plain centred photograph,
          because its origin is 50/50 and its scale is 1.
        */}
        <div
          className="absolute isolate bg-surface"
          style={{
            width: `${photoWidth}px`,
            height: `${photoHeight}px`,
            left: `calc(50% - ${(origin.x / 100) * photoWidth}px)`,
            top: `calc(50% - ${(origin.y / 100) * photoHeight}px)`,
            transform: `scale(${scale})`,
            transformOrigin: `${origin.x}% ${origin.y}%`,
            transition: reducedMotion
              ? "none"
              : "transform 320ms cubic-bezier(0.2, 0.7, 0.3, 1)",
          }}
        >
          <div className="absolute inset-0">
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
