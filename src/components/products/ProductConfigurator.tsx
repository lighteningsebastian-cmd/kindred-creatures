"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { productPhoto, formatZar, type Product } from "@/lib/products";

export type ProductConfiguratorProps = {
  product: Product;
};

/**
 * Client island owning colour and size selection for a product. Swaps the
 * photo to match the chosen colour and builds the customise CTA href from the
 * current selection. The CTA stays disabled until a size is picked.
 */
export function ProductConfigurator({ product }: ProductConfiguratorProps) {
  const [color, setColor] = useState(product.variants[0]);
  const [size, setSize] = useState<string | null>(
    color.sizes.length === 1 ? color.sizes[0] : null,
  );

  const sizeChosen = size !== null;
  const href = sizeChosen
    ? `/customize/${product.slug}?color=${encodeURIComponent(
        color.color,
      )}&size=${encodeURIComponent(size)}`
    : "#";

  const handleColorChange = (nextColorName: string) => {
    const nextColor =
      product.variants.find((variant) => variant.color === nextColorName) ??
      product.variants[0];
    setColor(nextColor);
    // Preserve a compatible size, otherwise reset (or auto-pick one-size).
    if (nextColor.sizes.length === 1) {
      setSize(nextColor.sizes[0]);
    } else if (size !== null && !nextColor.sizes.includes(size)) {
      setSize(null);
    }
  };

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      {/* Photo, keyed to selected colour */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-line bg-surface">
        <Image
          key={color.color}
          src={productPhoto(product.slug, 900, 1125, color.color)}
          alt={`${product.name} in ${color.color}, showing a pet portrait`}
          fill
          priority
          sizes="(max-width: 768px) 90vw, 45vw"
          className="object-cover"
        />
      </div>

      {/* Selection panel */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
            {product.name}
          </h1>
          <p className="text-2xl font-medium text-ink">
            {formatZar(color.priceZar)}
          </p>
          <p className="max-w-md leading-relaxed text-muted">{product.blurb}</p>
        </div>

        {/* Colour swatches */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ink">
            Colour: <span className="text-muted">{color.color}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {product.variants.map((variant) => {
              const selected = variant.color === color.color;
              return (
                <button
                  key={variant.color}
                  type="button"
                  onClick={() => handleColorChange(variant.color)}
                  aria-pressed={selected}
                  aria-label={variant.color}
                  title={variant.color}
                  className={cn(
                    "h-9 w-9 rounded-md border border-line transition-[box-shadow,transform] active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                    selected && "ring-2 ring-accent ring-offset-2 ring-offset-base",
                  )}
                  style={{ backgroundColor: variant.colorHex }}
                />
              );
            })}
          </div>
        </div>

        {/* Size pills */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ink">Size</p>
          <div className="flex flex-wrap gap-2">
            {color.sizes.map((option) => {
              const selected = option === size;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSize(option)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                    selected
                      ? "border-ink bg-ink text-base"
                      : "border-line text-ink hover:bg-surface",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {!sizeChosen && (
            <p className="text-sm text-muted">Choose a size to continue.</p>
          )}
        </div>

        {/* CTA */}
        {sizeChosen ? (
          <Button href={href} size="md" block className="mt-2 w-full sm:w-auto">
            Start your portrait
          </Button>
        ) : (
          <Button
            disabled
            size="md"
            block
            className="mt-2 w-full sm:w-auto"
            aria-disabled="true"
          >
            Start your portrait
          </Button>
        )}
      </div>
    </div>
  );
}
