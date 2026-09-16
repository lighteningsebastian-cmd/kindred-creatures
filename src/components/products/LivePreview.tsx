"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { getBreed } from "@/lib/breeds";
import { stockDisclosure, type CompanionProfile } from "@/lib/companion";
import type { GarmentSide } from "@/lib/garments";
import { GarmentPreview } from "./GarmentPreview";
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
 * The customizer's plate: our typeset outlines over the stand-in illustration,
 * which sits in the portrait window the layout reserved for it. The drawn
 * portrait does not exist yet; it is made after payment.
 */
function TypesetPlate({
  plate,
  stockUrl,
}: {
  plate: Plate;
  stockUrl: string | null;
}) {
  return (
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
        <GarmentPreview product={product} color={color} side={side}>
          {plate ? (
            <TypesetPlate plate={plate} stockUrl={result?.stockUrl ?? null} />
          ) : null}
        </GarmentPreview>
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
