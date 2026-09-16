"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  garmentImageUrl,
  photoAspect,
  placementFor,
  type GarmentSide,
} from "@/lib/garments";
import type { Product, Variant } from "@/lib/products";

/**
 * How much of the preview box's WIDTH the front plate fills when zoomed in.
 *
 * This is the only number to turn. The zoom factor is derived from it and from
 * the placement, rather than being a magic scale sitting next to a placement it
 * silently disagrees with: move the print on the garment and the camera follows
 * it. At a half, roughly a quarter of the garment is in frame, which is what the
 * owner asked for (5 August).
 */
const FRONT_ZOOM_FILL = 0.5;

/**
 * The transform that brings the front print up to a readable size.
 *
 * WHY THIS IS ONE TRANSFORM ON ONE WRAPPER, and the thing to not undo: the
 * plate is positioned as a PERCENTAGE OF THE PHOTOGRAPH. Scale the photograph
 * and leave the plate behind and the portrait ends up on the sleeve. So the
 * photograph and the plate move together, as one element, from one origin.
 *
 * `scale` about the plate's own centre holds that centre still, and the
 * `translate` then carries it to the middle of the box. Percentage translates
 * resolve against the untransformed box, so the two compose exactly.
 *
 * The scaled wrapper always covers the box: at any scale above about 2 the
 * content extends well past every edge, so there is no way to reveal a gap
 * beside the garment.
 */
function frontZoom(
  product: Product,
  color: Variant,
): { scale: number; ox: number; oy: number } {
  // The colourway's own placement: the tee's landscape shots put the print at
  // a different share of the frame, so the camera has to follow that one.
  const placement = placementFor(product.slug, color.color, "front");
  const print = product.printArea.front;

  // The plate is placed by WIDTH, so its height has to be derived. The two axes
  // are different percentages because the photograph and the print are
  // different shapes: 110 by 150mm of print on a portrait photograph.
  const heightPct =
    ((placement.width * print.heightMm) / print.widthMm) *
    photoAspect(product.slug, color.color, "front");

  return {
    scale: (FRONT_ZOOM_FILL * 100) / placement.width,
    ox: placement.left + placement.width / 2,
    oy: placement.top + heightPct / 2,
  };
}

/**
 * The width that fits a box of this shape inside its size container on BOTH
 * axes: all of the width, or as much as the height allows, whichever is less.
 * aspect-ratio then derives the height, so the box is always the photograph's
 * shape.
 */
export function photoBoxWidth(aspect: number): string {
  return `min(100cqw, calc(100cqh * ${aspect}))`;
}

/**
 * The garment, with the plate on it.
 *
 * The photograph is the background and the plate is a transparent layer over
 * it, so the garment colour shows through the plate exactly as ink will on
 * fabric. Changing colour swaps the photograph and never touches the plate.
 *
 * ONE COPY, TWO SCREENS. The customizer's live preview and "Wear it again"
 * both render through this, because placement is the thing that must never be
 * wrong and two copies of it is how two screens drift apart. What differs
 * between them is only what the plate IS, so that is the part passed in: the
 * customizer's typeset SVG over a stand-in illustration, or a reorder's finished
 * plate. Whatever arrives as `children` is laid inside the placement box at the
 * box's full width and sets its own height, so it must be the print area's
 * shape.
 */
export function GarmentPreview({
  product,
  color,
  side,
  children,
}: {
  product: Product;
  color: Variant;
  side: GarmentSide;
  /** The plate layer. Nothing is drawn over the garment when it is absent. */
  children?: ReactNode;
}) {
  const garment = garmentImageUrl(product.slug, color.color, side);
  const placement = placementFor(product.slug, color.color, side);

  // THE FRONT OPENS ZOOMED IN. The front print is 110mm wide on a garment
  // roughly 600mm across, so at full-garment zoom it is a smudge, and the
  // customer has just spent five questions building it. That is the view worth
  // seeing (owner, 5 August).
  //
  // THE BACK NEVER ZOOMS. The back plate is large and the whole point of it is
  // the whole plate.
  const [zoomedIn, setZoomedIn] = useState(true);
  const zoom = side === "front" && zoomedIn ? frontZoom(product, color) : null;
  const aspect = photoAspect(product.slug, color.color, side);

  return (
    // The OUTER box takes whatever space the flow gave it; the INNER box is the
    // photograph's own shape. Plate placement is a percentage of the photograph,
    // so if these two disagree the plate ends up measured against a crop rather
    // than against the garment.
    //
    // FIT BY BOTH SIDES, NOT BY HEIGHT. This used to be h-full with max-w-full,
    // which holds the shape only while the height is the limit. A landscape
    // photograph (the tee's Olive and Heritage Blue) in a narrow column hit the
    // width cap first, the height stayed put, and the box went 0.86 wide for a
    // 1.25 photograph: object-cover cropped the garment and the plate landed
    // somewhere else on it. The outer box is a size container, so the width
    // can be the smaller of "all of it" and "as wide as the height allows", and
    // aspect-ratio derives the height from that.
    <div className="flex h-full min-h-0 w-full items-center justify-center [container-type:size]">
      <div
        className="relative overflow-hidden rounded-md border border-line bg-surface"
        style={{
          aspectRatio: aspect,
          width: photoBoxWidth(aspect),
        }}
      >
      {/*
        ONE WRAPPER, HOLDING BOTH, TRANSFORMED AS ONE. The plate is placed as a
        percentage of the photograph, so anything that scales the photograph has
        to scale the plate by the same transform from the same origin. Putting
        the transform on the image alone would leave the portrait on the sleeve.
        Nothing inside here knows it is being zoomed.

        It is inset-0 rather than a size of its own, so the geometry of the box
        around it is untouched. On a phone that box is a fixed share of the
        viewport (docs/flow-review-2.md bug 3) and its height must not move.
      */}
      <div
        className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-300"
        style={
          zoom
            ? {
                transform: `translate(${50 - zoom.ox}%, ${50 - zoom.oy}%) scale(${zoom.scale})`,
                transformOrigin: `${zoom.ox}% ${zoom.oy}%`,
              }
            : undefined
        }
      >
        {garment ? (
          <Image
            src={garment}
            alt={`${product.name} in ${color.color}, ${side}`}
            fill
            // Asks for the whole source. The front is enlarged about fourfold,
            // and the shoot files are 1120px wide, so the largest available is
            // always the right pick rather than a box-sized crop upscaled.
            sizes="(min-width: 1024px) 100vw, 200vw"
            // contain, not cover: a cropped garment in a short box is a hoodie with
            // its hem cut off, and the plate placement is a percentage of the whole
            // photograph, so cropping would move the plate off the garment.
            // cover is exact now: the box IS the photograph's shape.
            className="object-cover"
            // The preview is the first thing worth seeing on this page.
            priority
          />
        ) : (
          // No photograph for this garment yet (the tote). The plate still shows,
          // on the garment's own colour, rather than on nothing at all.
          <div
            className="absolute inset-0"
            style={{ backgroundColor: color.colorHex }}
          />
        )}

        {children ? (
          <div
            className="absolute"
            style={{
              top: `${placement.top}%`,
              left: `${placement.left}%`,
              width: `${placement.width}%`,
            }}
          >
            {children}
          </div>
        ) : null}
      </div>

      {/*
        TWO STATES, NOT A CONTINUUM, so this is a button and not a slider. It is
        absolutely positioned, over the corner of the preview and outside the
        transformed wrapper, so it neither scales with the garment nor adds a
        pixel to the box's height.
      */}
      {side === "front" ? (
        <button
          type="button"
          onClick={() => setZoomedIn((on) => !on)}
          className={cn(
            "absolute bottom-2 right-2 rounded-md border border-line px-2.5 py-1",
            "bg-base/90 text-xs text-ink backdrop-blur-sm transition-colors",
            "hover:bg-surface focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-accent focus-visible:ring-offset-2",
            "focus-visible:ring-offset-base",
          )}
        >
          {zoomedIn ? "Whole garment" : "Zoom in"}
        </button>
      ) : null}
      </div>
    </div>
  );
}
