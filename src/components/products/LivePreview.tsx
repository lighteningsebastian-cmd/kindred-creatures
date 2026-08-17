"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { getBreed } from "@/lib/breeds";
import { stockDisclosure, type CompanionProfile } from "@/lib/companion";
import {
  PLACEMENT,
  garmentImageUrl,
  photoAspect,
  type GarmentSide,
} from "@/lib/garments";
import type { Product, Variant } from "@/lib/products";
import type {
  PlatePreview as Plate,
  PreviewResult,
} from "@/app/products/[slug]/actions";

/** Long enough that typing a name does not fire a render per keystroke. */
const DEBOUNCE_MS = 250;

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

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
  const placement = PLACEMENT[product.slug].front;
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
 * The garment, with the plate on it.
 *
 * The photograph is the background and the plate is a transparent PNG over it,
 * so the garment colour shows through the plate exactly as ink will on fabric.
 * Changing colour swaps the photograph and never touches the plate.
 */
function GarmentView({
  product,
  color,
  side,
  plate,
  stockUrl,
}: {
  product: Product;
  color: Variant;
  side: GarmentSide;
  plate: Plate | null;
  stockUrl: string | null;
}) {
  const garment = garmentImageUrl(product.slug, color.color, side);
  const placement = PLACEMENT[product.slug][side];

  // THE FRONT OPENS ZOOMED IN. The front print is 110mm wide on a garment
  // roughly 600mm across, so at full-garment zoom it is a smudge, and the
  // customer has just spent five questions building it. That is the view worth
  // seeing (owner, 5 August).
  //
  // THE BACK NEVER ZOOMS. The back plate is large and the whole point of it is
  // the whole plate.
  const [zoomedIn, setZoomedIn] = useState(true);
  const zoom = side === "front" && zoomedIn ? frontZoom(product, color) : null;

  return (
    // The OUTER box takes whatever height the flow gave it; the INNER box is the
    // photograph's own shape. Plate placement is a percentage of the photograph,
    // so if these two disagree the plate ends up measured against letterboxing
    // rather than against the garment.
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <div
        className="relative h-full max-h-full max-w-full overflow-hidden rounded-md border border-line bg-surface"
        style={{ aspectRatio: photoAspect(product.slug, color.color, side) }}
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

        {plate ? (
          <div
            className="absolute"
            style={{
              top: `${placement.top}%`,
              left: `${placement.left}%`,
              width: `${placement.width}%`,
            }}
          >
            <div className="relative">
              {stockUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={stockUrl}
                  alt=""
                  className="absolute object-contain"
                  style={{
                    left: `${plate.portrait.x * 100}%`,
                    top: `${plate.portrait.y * 100}%`,
                    width: `${plate.portrait.width * 100}%`,
                    height: `${plate.portrait.height * 100}%`,
                  }}
                />
              ) : null}
              {/* Outlines, so the type stays crisp at any size. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUrl(plate.svg)} alt="" className="w-full" />
            </div>
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

/**
 * The preview panel: always on screen, never gated.
 *
 * THE POINT OF THIS COMPONENT is that there is a moment where the customer sees
 * the thing they are buying. It renders from the first paint with the garment in
 * its default colour and an empty plate, and fills in as they answer. Typing a
 * name puts it on the plate; choosing a breed fills ORIGIN and GROUP on its own,
 * and that is the moment that sells the product, so it must be visible without
 * scrolling.
 *
 * It is deliberately NOT gated on a colour and size choice. The owner looked at
 * the gated version twice and believed the page was broken; a customer would
 * simply leave.
 *
 * Defaults to the back, because the plate is the product.
 */
export function LivePreview({
  profile,
  product,
  color,
  render,
}: {
  profile: CompanionProfile;
  product: Product;
  color: Variant;
  render: (
    profile: CompanionProfile,
    aspect: { width: number; height: number },
  ) => Promise<PreviewResult>;
}) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [side, setSide] = useState<GarmentSide>("back");

  // The BACK plate's shape drives the render request: it is the large plate,
  // and the front is set from its own measured area inside previewPlates.
  const { widthMm, heightMm } = product.printArea.back;

  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      const next = await render(profile, {
        width: 900,
        height: Math.round((900 * heightMm) / widthMm),
      });
      // The last render wins: an earlier, slower answer must not overwrite it.
      if (live) setResult(next);
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [profile, render, widthMm, heightMm]);

  const breed = profile.breedId ? getBreed(profile.breedId) : undefined;
  // One of One and other species get the version with no breed named.
  const disclosure = stockDisclosure(
    breed && !breed.oneOfOne ? breed.name : null,
  );

  const plate = result ? (side === "back" ? result.back : result.front) : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow text-xs text-accent">Their piece</p>
        <div className="flex gap-1" role="group" aria-label="Which side to show">
          {(["back", "front"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={side === option}
              onClick={() => setSide(option)}
              className={cn(
                "rounded-md border px-3 py-1 text-sm capitalize transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                side === option
                  ? "border-btn bg-btn text-base"
                  : "border-line text-ink hover:bg-surface",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <GarmentView
          product={product}
          color={color}
          side={side}
          plate={plate}
          stockUrl={result?.stockUrl ?? null}
        />
      </div>

      <p className="hidden shrink-0 text-sm text-muted lg:block">
        {product.name} in {color.color}
      </p>

      {/*
        Always on whenever a stand-in illustration is, never behind a tooltip and
        never dependent on the render arriving. Hidden only when there is no
        illustration to be honest about: saying "the illustration shown is a
        Yorkshire Terrier example" over a hatched placeholder is not a
        disclosure, it is a claim about something that is not there.
      */}
      {result?.stockUrl ? (
        <p className="shrink-0 text-sm leading-relaxed text-muted">
          {disclosure}
        </p>
      ) : null}
    </div>
  );
}
