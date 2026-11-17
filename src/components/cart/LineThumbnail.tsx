"use client";

import { useState } from "react";
import Image from "next/image";
import { garmentImageUrl } from "@/lib/garments";
import { getProduct, type ProductSlug, type Variant } from "@/lib/products";
import type { CartItem } from "@/lib/cart-store";

/**
 * The catalogue variant a cart line names, or undefined once it has gone.
 *
 * A line carries a colour, and the photograph belongs to the variant, so the
 * thumbnail comes back through the catalogue to find it. Task 3 of the men's
 * and women's work gives a line its fit, and this lookup takes that too; until
 * then a colour names exactly one variant of a product.
 */
function variantFor(slug: ProductSlug, color: string): Variant | undefined {
  return getProduct(slug)?.variants.find((v) => v.color === color);
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
  const variant = variantFor(item.productSlug, item.color);
  const garment = variant
    ? garmentImageUrl(item.productSlug, variant.photoDir, "front")
    : null;
  const swatch = variant?.colorHex;

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
