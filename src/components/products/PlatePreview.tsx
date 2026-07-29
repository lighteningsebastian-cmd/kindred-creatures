"use client";

import { useEffect, useState } from "react";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { getBreed } from "@/lib/breeds";
import { stockDisclosure, type CompanionProfile } from "@/lib/companion";
import type { PlatePreview as Plate, PreviewResult } from "@/app/products/[slug]/actions";
import type { Product, Variant } from "@/lib/products";

/** Long enough that typing a name does not fire a render per keystroke. */
const DEBOUNCE_MS = 350;

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** One plate: the garment colour, the illustration, then the type on top. */
function PlateFace({
  plate,
  stockUrl,
  colorHex,
  aspect,
  label,
}: {
  plate: Plate;
  stockUrl: string | null;
  colorHex: string;
  aspect: string;
  label: string;
}) {
  const box = {
    left: `${plate.portrait.x * 100}%`,
    top: `${plate.portrait.y * 100}%`,
    width: `${plate.portrait.width * 100}%`,
    height: `${plate.portrait.height * 100}%`,
  };

  return (
    <figure className="flex flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-md border border-line"
        style={{ aspectRatio: aspect, backgroundColor: colorHex }}
      >
        <div className="absolute" style={box}>
          {stockUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stockUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            // The library is drawn breed by breed, so most breeds land here for
            // now. The kit's own placeholder, rather than an unrelated stock dog.
            <PhotoFrame
              aspect="1 / 1"
              description="breed illustration, house style, side profile"
              className="h-full"
            />
          )}
        </div>
        {/* The type layer. Outlines, so it stays crisp at any size. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl(plate.svg)}
          alt=""
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <figcaption className="text-center text-sm text-muted">{label}</figcaption>
    </figure>
  );
}

/**
 * The plate, both sides, on their garment, before they have paid a cent.
 *
 * This is the whole reason generation can happen after payment: their name,
 * their breed's origin and group, their three words and their year are all
 * here, on the real plate, for nothing. Only the animal is a stand-in, and the
 * line underneath says so.
 *
 * The plates are rendered by the SAME code that composes the print file, so
 * this is the plate rather than an impression of one.
 */
export function PlatePreview({
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

  const { widthMm, heightMm } = product.printArea;
  const aspect = `${widthMm} / ${heightMm}`;

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

  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-display text-2xl text-ink">Their plate</h3>

      {result ? (
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr] sm:items-start">
          <PlateFace
            plate={result.back}
            stockUrl={result.stockUrl}
            colorHex={color.colorHex}
            aspect={aspect}
            label="Back"
          />
          <PlateFace
            plate={result.front}
            stockUrl={result.stockUrl}
            colorHex={color.colorHex}
            aspect="1 / 1"
            label="Left chest"
          />
        </div>
      ) : (
        <div
          className="w-full rounded-md border border-line"
          style={{ aspectRatio: aspect }}
          aria-hidden="true"
        />
      )}

      {/*
        Always on, never behind a tooltip, and never dependent on the render
        arriving: the moment a stand-in illustration is on screen this has to be
        readable next to it.
      */}
      <p className="text-sm leading-relaxed text-muted">{disclosure}</p>
    </section>
  );
}
