"use client";

import { useState } from "react";
import { ProductConfigurator } from "./ProductConfigurator";
import { CompanionForm } from "./CompanionForm";
import { LivePreview } from "./LivePreview";
import { Customizer } from "@/components/customizer/Customizer";
import {
  checkCreatureName,
  logBreedRequest,
  previewPlates,
  saveArtworkDetails,
} from "@/app/products/[slug]/actions";
import { emptyProfile } from "@/lib/companion";
import type { Product, Variant } from "@/lib/products";

export type ProductFlowProps = {
  product: Product;
  /** Colour from the `?color=` deep link, if present and valid. */
  initialColor?: string;
  /** Size from the `?size=` deep link, if present and valid. */
  initialSize?: string;
};

function resolveColor(product: Product, name?: string): Variant {
  return product.variants.find((v) => v.color === name) ?? product.variants[0];
}

function resolveSize(color: Variant, size?: string): string | null {
  // A one-size product has nothing to choose, so it is settled from the start.
  if (color.sizes.length === 1) return color.sizes[0];
  return size && color.sizes.includes(size) ? size : null;
}

/**
 * The whole product-to-portrait flow on one page: the form on the left, a live
 * preview of the garment on the right, and nothing hidden behind anything.
 *
 * WHAT CHANGED AND WHY (docs/spec-flow-fixes.md section 5). The portrait half
 * used to be gated on a colour and size choice, and the plate appeared somewhere
 * below a form with no garment in the picture at all. The owner looked at that
 * page twice and believed it was broken. There is no gate now: the preview
 * renders from the first paint, showing the default colourway and an empty
 * plate, and fills in as the customer answers. On desktop it sticks alongside
 * the form; on mobile it sticks to the top, above it.
 *
 * The form's order is about momentum rather than gating: the name first because
 * it lands on the plate as they type, then the breed, because choosing it fills
 * in ORIGIN and GROUP on its own. That autofill is the moment that sells the
 * product, so the preview has to be beside it, not below the fold.
 */
export function ProductFlow({
  product,
  initialColor,
  initialSize,
}: ProductFlowProps) {
  const startColor = resolveColor(product, initialColor);
  const [color, setColor] = useState<Variant>(startColor);
  const [size, setSize] = useState<string | null>(() =>
    resolveSize(startColor, initialSize),
  );
  const [profile, setProfile] = useState(emptyProfile());

  const handleColorChange = (colorName: string) => {
    const next = resolveColor(product, colorName);
    setColor(next);
    // Keep a still-valid size; otherwise settle a one-size or clear it.
    if (next.sizes.length === 1) setSize(next.sizes[0]);
    else if (size !== null && !next.sizes.includes(size)) setSize(null);
  };

  return (
    <div className="flex flex-col gap-14 lg:flex-row-reverse lg:items-start lg:gap-12">
      {/*
        The preview. Sticky on both layouts, so it is never scrolled away from
        the field that is changing it. It comes FIRST in the DOM and is flipped
        to the right on desktop with flex-row-reverse, which puts it above the
        form on mobile with no duplication and no second render.
      */}
      <aside className="sticky top-0 z-10 -mx-4 bg-base px-4 py-4 shadow-sm lg:top-24 lg:mx-0 lg:w-[38%] lg:shrink-0 lg:bg-transparent lg:px-0 lg:shadow-none">
        <LivePreview
          profile={profile}
          product={product}
          color={color}
          render={previewPlates}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-14">
        <CompanionForm
          profile={profile}
          onChange={setProfile}
          checkName={checkCreatureName}
          onBreedMiss={(query) => logBreedRequest(query, profile.species)}
        />

        {/* Style, then the photo, then the cart. */}
        <div className="border-t border-line pt-12">
          <Customizer
            product={product}
            color={color}
            size={size}
            profile={profile}
            save={saveArtworkDetails}
          />
        </div>

        {/* Colour and size last: the preview updates live as they are changed. */}
        <div className="border-t border-line pt-12">
          <ProductConfigurator
            product={product}
            color={color}
            size={size}
            onColorChange={handleColorChange}
            onSizeChange={setSize}
          />
        </div>
      </div>
    </div>
  );
}
