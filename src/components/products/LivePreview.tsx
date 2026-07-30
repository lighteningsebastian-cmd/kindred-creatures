"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { getBreed } from "@/lib/breeds";
import { stockDisclosure, type CompanionProfile } from "@/lib/companion";
import { PLACEMENT, garmentImageUrl, type GarmentSide } from "@/lib/garments";
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

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-line bg-surface"
      style={{ aspectRatio: "4 / 5" }}
    >
      {garment ? (
        <Image
          src={garment}
          alt={`${product.name} in ${color.color}, ${side}`}
          fill
          sizes="(min-width: 1024px) 40vw, 100vw"
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

  const { widthMm, heightMm } = product.printArea;

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
    <div className="flex flex-col gap-4">
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

      <GarmentView
        product={product}
        color={color}
        side={side}
        plate={plate}
        stockUrl={result?.stockUrl ?? null}
      />

      <p className="text-sm text-muted">
        {product.name} in {color.color}
      </p>

      {/*
        Always on, never behind a tooltip, and never dependent on the render
        arriving: the moment a stand-in illustration is on screen this has to be
        readable next to it.
      */}
      <p className="text-sm leading-relaxed text-muted">{disclosure}</p>
    </div>
  );
}
