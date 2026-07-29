"use client";

import { useEffect, useRef, useState } from "react";
import { ProductConfigurator } from "./ProductConfigurator";
import { CompanionForm } from "./CompanionForm";
import { Customizer } from "@/components/customizer/Customizer";
import { checkCreatureName, logBreedRequest } from "@/app/products/[slug]/actions";
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
 * The whole product-to-portrait flow on one page. This island owns the colour
 * and size selection and feeds it to both halves: the {@link ProductConfigurator}
 * up top and the portrait {@link Customizer} below. Choosing a colour and size
 * activates the portrait step in place and smooth-scrolls it into view; before
 * that it sits disabled but present, so the page never jumps. The artwork lives
 * inside the Customizer, so changing colour or size afterwards updates the
 * mockup without discarding a portrait already made.
 *
 * A `?color=&size=` deep link (the old /customize entry point, now redirected
 * here) is read on the server and handed in as `initialColor`/`initialSize`, so
 * a deep-linked visit renders with the portrait step already active.
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

  const active = size !== null;
  const portraitRef = useRef<HTMLDivElement>(null);
  // ponytail: the profile is held here and not yet persisted. It lands on the
  // artwork row when the flow is reordered around payment (spec-pipeline.md
  // build order steps 4 and 5); until then a reload loses it.
  const [profile, setProfile] = useState(emptyProfile());

  // Scroll on the transition into an active state. Seeded so a size arriving on
  // the deep link (an explicit `?size=`) scrolls on first paint, while a
  // one-size product that settles its own size on load does NOT, or the page
  // would jump for everyone.
  const settledOnce = useRef<boolean>(active && !initialSize);

  const handleColorChange = (colorName: string) => {
    const next = resolveColor(product, colorName);
    setColor(next);
    // Keep a still-valid size; otherwise settle a one-size or clear it.
    if (next.sizes.length === 1) setSize(next.sizes[0]);
    else if (size !== null && !next.sizes.includes(size)) setSize(null);
  };

  useEffect(() => {
    if (!active) {
      settledOnce.current = false;
      return;
    }
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Reduced motion enables the step but never auto-scrolls.
    if (!settledOnce.current && !reduce) {
      portraitRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    settledOnce.current = true;
  }, [active]);

  return (
    <div className="flex flex-col">
      <ProductConfigurator
        product={product}
        color={color}
        size={size}
        onColorChange={handleColorChange}
        onSizeChange={setSize}
      />

      <div
        ref={portraitRef}
        className="mt-14 scroll-mt-24 border-t border-line pt-12 md:mt-20"
      >
        {active ? (
          <div className="mb-14 md:mb-20">
            <CompanionForm
              profile={profile}
              onChange={setProfile}
              checkName={checkCreatureName}
              onBreedMiss={(query) => logBreedRequest(query, profile.species)}
            />
          </div>
        ) : null}

        <Customizer product={product} color={color} size={size} active={active} />
      </div>
    </div>
  );
}
