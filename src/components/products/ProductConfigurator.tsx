"use client";

import { cn } from "@/lib/cn";
import { PhotoFrame } from "@/components/ui/PhotoFrame";
import { formatZar, type Product, type Variant } from "@/lib/products";

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
  /**
   * Show only one half of the configurator. The flow asks for colour and size as
   * separate questions now (docs/flow-review-2.md), and a page that shows both
   * at once is the shopping-first page that reordering was meant to end.
   */
  only?: "colour" | "size";
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
  only,
}: ProductConfiguratorProps) {
  const sizeChosen = size !== null;

  return (
    <div
      className={
        only
          ? "flex flex-col gap-6"
          : "grid gap-10 md:grid-cols-2 md:gap-14"
      }
    >
      {/* Photo, keyed to selected colour: the description tracks the swatch.
          Suppressed when the flow asks for one control at a time, because the
          live preview beside it is already showing the real garment. */}
      {only ? null : <PhotoFrame
        aspect="4 / 5"
        description={`flatlay: the ${product.name.replace(/^The /, "").toLowerCase()} in ${color.color}, pressed and folded, a pet portrait print centred, soft daylight`}
      />}

      {/* Selection panel */}
      <div className="flex flex-col gap-6">
        {only ? null : <div className="flex flex-col gap-3">
          <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
            {product.name}
          </h1>
          <p className="text-2xl font-medium text-ink">
            {formatZar(color.priceZar)}
          </p>
          <p className="max-w-md leading-relaxed text-muted">{product.blurb}</p>
        </div>}

        {/* Colour swatches */}
        {only === "size" ? null : <div className="flex flex-col gap-3">
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
        </div>}

        {/* Size pills */}
        {only === "colour" ? null : <div className="flex flex-col gap-3">
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
                    // Oxblood, like every other selected state on the site.
                    selected
                      ? "border-btn bg-btn text-base"
                      : "border-line text-ink hover:bg-surface",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {!sizeChosen && (
            <p className="text-sm text-muted">Choose a size to carry on.</p>
          )}
        </div>}
      </div>
    </div>
  );
}
