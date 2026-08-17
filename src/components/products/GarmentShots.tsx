"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { PLACEMENT, type GarmentSide } from "@/lib/garments";
import { viewLabel, type Shot } from "@/lib/garment-shots";
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
}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  // The tote. Rendering an empty bordered box beside a real card is worse than
  // rendering nothing and letting the caller fall back to its placeholder.
  if (shots.length === 0) return null;

  // HOVER ADVANCES BY ONE, it does not cycle. A card that walks through four
  // pictures while the cursor rests on it is a card nobody can read. One nudge
  // to show there is more here; the dots are how you get to the rest.
  const showing =
    hovered && shots.length > 1 ? (index + 1) % shots.length : index;
  const shot = shots[showing]!;
  // `printed` is true only for "front" and "back", which are exactly the two
  // keys PLACEMENT has, so the cast is the type system catching up with the
  // manifest rather than a hole in it.
  const placement = shot.printed
    ? PLACEMENT[slug][shot.view as GarmentSide]
    : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        data-testid="garment-shots"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex w-full items-center justify-center overflow-hidden bg-surface"
        style={{ aspectRatio: aspect }}
      >
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
      </div>

      {shots.length > 1 ? (
        <div
          className="flex items-center justify-center gap-2"
          role="group"
          aria-label="Which aspect to show"
        >
          {shots.map((option, optionIndex) => (
            <button
              key={option.view}
              type="button"
              aria-label={viewLabel(option.view)}
              aria-pressed={showing === optionIndex}
              onClick={() => {
                setIndex(optionIndex);
                // Otherwise the hover offset immediately advances past the dot
                // the visitor just pressed, and the picture they asked for is
                // the one they cannot get to with a mouse.
                setHovered(false);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                showing === optionIndex
                  ? "w-5 bg-accent-secondary"
                  : "w-1.5 bg-line-strong hover:bg-accent-secondary/60",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
