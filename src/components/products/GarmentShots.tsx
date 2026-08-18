"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PLACEMENT, type GarmentSide } from "@/lib/garments";
import type { Shot } from "@/lib/garment-shots";
import { PrintLightbox } from "./PrintLightbox";
import type { ProductSlug } from "@/lib/products";

/**
 * A card's image area: the garment, the print on it, and the other aspects of
 * it a click away.
 *
 * TWO THINGS THIS DOES THAT ARE NOT DECORATION.
 *
 * The parchment lift. The shoot is blank garments on white, which is right for
 * the customizer and wrong for a card on a parchment page. Backgrounds measure
 * 253 to 255 across every file with no vignette, so `mix-blend-mode: multiply`
 * over a parchment fill drops the background to exactly the surface colour and
 * leaves the garment. No second copy of 34 files, and it works on colourways
 * that arrive later. It costs about 5% darkening on the garment, which reads as
 * fabric on a warm surface; white garments take the tint and read as cream.
 *
 * The nested boxes. The OUTER box is whatever shape the grid asked for. The
 * INNER box is the PHOTOGRAPH'S own shape. This is the one thing here not to
 * simplify: plate placement is a percentage of the photograph, so a box of any
 * other shape letterboxes the picture while the plate keeps measuring against
 * the box, and the portrait ends up on the parchment beside the garment.
 * GarmentView in LivePreview.tsx carries the same structure for the same
 * reason.
 */
export function GarmentShots({
  shots,
  slug,
  aspect = "4 / 5",
  className,
  preload = false,
  sizes = "(min-width: 768px) 45vw, 100vw",
  zoomable = false,
}: {
  shots: Shot[];
  /** Whose placement to use. Required: a printed shot cannot be placed without it. */
  slug: ProductSlug;
  /** CSS aspect-ratio for the outer box, set by the grid. */
  aspect?: string;
  className?: string;
  /**
   * Preload this card's first photograph, for the one tile above the fold.
   *
   * `preload`, not `priority`: Next 16 deprecated the latter in favour of this
   * (see the image guide in node_modules/next/dist/docs/), and AGENTS.md says
   * to heed deprecation notices. LivePreview.tsx still passes `priority` and
   * predates the upgrade; that is debt, not a pattern to copy.
   */
  preload?: boolean;
  sizes?: string;
  /**
   * Whether the picture opens a lightbox. Shop only.
   *
   * The home page deliberately does not get this. A modal on a teaser tile is
   * a different proposition from one on a product card: the tile's job is the
   * range, and the card's job is the detail. Owner decision, 18 August.
   */
  zoomable?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The tote. Rendering an empty bordered box beside a real card is worse than
  // rendering nothing and letting the caller fall back to its placeholder.
  if (shots.length === 0) return null;

  // HOVER ADVANCES BY ONE, it does not cycle. A card that walks through four
  // pictures while the cursor rests on it is a card nobody can read. One nudge
  // to show there is more here; the dots are how you get to the rest.
  //
  // NOT WHEN THE PICTURE IS CLICKABLE, and this is not a preference. You
  // cannot click a thing without hovering it, so on a zoomable card the
  // advance fires at the exact moment someone reaches to enlarge: they press
  // "Chest print", move the cursor onto the picture, and the hover bumps them
  // to fleece before the click lands. They can never enlarge the view they
  // asked for. It is the same failure the setHovered(false) below guards the
  // dots against, and here the only fix is not to advance at all.
  //
  // Nothing is lost. Hover-advance exists to hint "there is more here" on a
  // tile you cannot interact with; a zoomable picture already says that with a
  // zoom cursor, a focus ring and a real button.
  const hoverAdvances = hovered && shots.length > 1 && !zoomable;
  const showing = hoverAdvances ? (index + 1) % shots.length : index;
  const shot = shots[showing]!;
  // `printed` is true only for "front" and "back", which are exactly the two
  // keys PLACEMENT has, so the cast is the type system catching up with the
  // manifest rather than a hole in it.
  const placement = shot.printed
    ? PLACEMENT[slug][shot.view as GarmentSide]
    : null;

  const closeZoom = () => {
    setZoomed(false);
    // Focus has to come back out of a dialog that is about to stop existing,
    // or it lands on <body> and a keyboard visitor loses their place on the
    // page entirely.
    triggerRef.current?.focus();
  };

  const picture = (
    <>
      {/*
        The photograph's own shape, centred in whatever box the grid gave us.
        isolate creates a stacking context so the multiply below blends
        against this box's parchment and not against whatever the page has
        behind the card.
      */}
      <div
        className="relative isolate h-full max-h-full max-w-full bg-surface"
        style={{ aspectRatio: shot.aspect }}
      >
          <Image
            key={shot.url}
            src={shot.url}
            alt={shot.alt}
            fill
            sizes={sizes}
            preload={preload}
            // multiply drops the white studio background to the parchment
            // beneath it. See the note at the top of this file.
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
                  through it exactly as ink does on fabric. */}
              <Image
                src={shot.plateUrl}
                alt=""
                width={900}
                height={1125}
                sizes="30vw"
                className="h-auto w-full"
              />
            </div>
          ) : null}
      </div>
    </>
  );

  // A REAL BUTTON WHEN IT DOES SOMETHING, a plain div when it does not. A
  // click handler on a div is unreachable by keyboard and announces nothing;
  // rendering the element the behaviour deserves is cheaper than bolting
  // tabIndex and a key handler onto the wrong one.
  const frameClass =
    "relative flex w-full items-center justify-center overflow-hidden bg-surface";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {zoomable ? (
        <button
          ref={triggerRef}
          type="button"
          data-testid="garment-shots"
          onClick={() => setZoomed(true)}
          aria-label={`Enlarge: ${shot.label.toLowerCase()}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            frameClass,
            "cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
          )}
          style={{ aspectRatio: aspect }}
        >
          {picture}
        </button>
      ) : (
        <div
          data-testid="garment-shots"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={frameClass}
          style={{ aspectRatio: aspect }}
        >
          {picture}
        </div>
      )}

      {zoomed ? (
        <PrintLightbox shot={shot} slug={slug} onClose={closeZoom} />
      ) : null}

      {shots.length > 1 ? (
        <div
          className="flex items-center justify-center gap-2"
          role="group"
          aria-label={
            shots[0]!.swatchHex ? "Which colour to show" : "Which aspect to show"
          }
        >
          {shots.map((option, optionIndex) => (
            <button
              // NOT option.view. Every colourway shot is a "back", so keying on
              // the view collapses four controls onto one React key and the
              // list stops updating correctly. The label is unique on both
              // axes: a view name on the shop, a colour name on the home page.
              key={option.label}
              type="button"
              aria-label={option.label}
              aria-pressed={showing === optionIndex}
              onClick={() => {
                setIndex(optionIndex);
                // Otherwise the hover offset immediately advances past the dot
                // the visitor just pressed, and the picture they asked for is
                // the one they cannot get to with a mouse.
                setHovered(false);
              }}
              className={cn(
                // THE DOT IS 6px TALL; THE BUTTON MUST NOT BE. These dots are
                // the touch affordance — hover is not something a phone has —
                // and a 6px target is a control only a mouse can use. The
                // padding is the hit area, the span is the thing you see.
                "group/dot flex items-center justify-center rounded-full px-1 py-3",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
              )}
            >
              {option.swatchHex ? (
                <span
                  // THE INSET BORDER IS NOT DECORATION. Hoodie White is #F3EFE9
                  // against a #EAE7E1 tile; without an edge a near-white swatch
                  // is invisible on parchment. CatalogueCard's own swatch row
                  // solves this the same way and the two must not diverge.
                  //
                  // Selection is a RING rather than a fill change, because
                  // changing the fill would mean the control no longer shows
                  // the colour it selects — and on White or Grey there is no
                  // darker fill available that still reads as that colour.
                  style={{ backgroundColor: option.swatchHex }}
                  className={cn(
                    "h-[13px] w-[13px] rounded-full transition-shadow",
                    showing === optionIndex
                      ? "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.16),0_0_0_2px_var(--color-surface),0_0_0_3.5px_var(--color-accent-secondary)]"
                      : "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.16)]",
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    showing === optionIndex
                      ? "w-5 bg-accent-secondary"
                      : "w-1.5 bg-line-strong group-hover/dot:bg-accent-secondary/60",
                  )}
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
