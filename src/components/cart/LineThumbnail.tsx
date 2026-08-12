"use client";

import { useState } from "react";
import Image from "next/image";
import { garmentImageUrl } from "@/lib/garments";
import { getProduct, type ProductSlug } from "@/lib/products";
import type { CartItem } from "@/lib/cart-store";

/** The chosen colourway's own colour, for a garment with no photograph. */
function swatchHex(slug: ProductSlug, color: string): string | undefined {
  return getProduct(slug)?.variants.find((v) => v.color === color)?.colorHex;
}

/**
 * The picture on a line, in the cart and again at checkout: the plate they
 * built, set the way it prints.
 *
 * THE PLATE, NOT THE GARMENT, because the plate is the part they made. Five
 * questions went into the breed, the words and the name, and a photograph of a
 * plain white hoodie shows none of it back to them. It is served as SVG from
 * the artwork's own profile, so it is their creature's plate rather than a
 * picture of one, and it fills the box rather than sitting at true placement:
 * at 80px, a plate at 46% of a garment's width is an illegible smudge.
 *
 * The portrait window inside it is empty, and honestly so. The drawing happens
 * after payment.
 *
 * FALLING BACK TO THE GARMENT is what happens when the route says no, which it
 * does for an artwork with no finished profile behind it. A half-empty plate
 * reads as a fault; the garment photograph is a picture of something real.
 *
 * It expects a positioned box around it, and fills it.
 */
export function LineThumbnail({
  item,
  productLabel,
  /** What the box is, so next/image asks for the right size on the fallback. */
  sizes = "112px",
}: {
  item: CartItem;
  productLabel: string;
  sizes?: string;
}) {
  const [plateFailed, setPlateFailed] = useState(false);
  const garment = garmentImageUrl(item.productSlug, item.color, "front");
  const swatch = swatchHex(item.productSlug, item.color);

  if (!plateFailed) {
    return (
      // The garment's own colour behind it, so the ink sits on the fabric it
      // will be printed on rather than on the page.
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ backgroundColor: swatch }}
      >
        {/* Not next/image: this is a dynamic SVG rendered per request, which
            the optimiser refuses by default and could not usefully resize
            anyway. The plate carries its own margin, so it needs no padding. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/artwork/${item.artworkId}/plate`}
          alt={`Your design for ${productLabel} in ${item.color}`}
          className="h-full w-full object-contain"
          onError={() => setPlateFailed(true)}
        />
      </div>
    );
  }

  return garment ? (
    <Image
      src={garment}
      alt={`${productLabel} in ${item.color}`}
      fill
      sizes={sizes}
      className="object-cover"
    />
  ) : (
    // No photograph for this garment yet (the tote). Its own colour, rather
    // than an empty frame.
    <div className="absolute inset-0" style={{ backgroundColor: swatch }} />
  );
}
