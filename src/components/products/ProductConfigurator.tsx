"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import { productPhoto, formatZar, type Product, type Variant } from "@/lib/products";

export type ProductConfiguratorProps = {
  product: Product;
  /** The selected colourway. Owned by the parent flow. */
  color: Variant;
  /** The selected size, or null until one is picked. Owned by the parent. */
  size: string | null;
  /** Asks the parent to switch colourway (by colour name). */
  onColorChange: (colorName: string) => void;
  /** Asks the parent to set the size. */
  onSizeChange: (size: string) => void;
};

/**
 * The top of the product flow: the garment shot keyed to the chosen colour, the
 * name/price/blurb, and the colour + size pickers. Selection state is owned by
 * the parent {@link ProductFlow} so the portrait step below reads the same
 * colour and size; this component only renders them and reports changes. There
 * is no CTA any more: choosing a size activates the portrait step in place.
 */
export function ProductConfigurator({
  product,
  color,
  size,
  onColorChange,
  onSizeChange,
}: ProductConfiguratorProps) {
  const sizeChosen = size !== null;

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
                  onClick={() => onColorChange(variant.color)}
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
                  onClick={() => onSizeChange(option)}
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
            <p className="text-sm text-muted">
              Choose a size to start their portrait.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
