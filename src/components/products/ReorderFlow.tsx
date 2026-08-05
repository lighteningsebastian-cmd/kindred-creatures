"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { PRODUCTS, formatZar, type Product, type Variant } from "@/lib/products";
import { useCartStore } from "@/lib/cart-store";
import { trackCreatureReordered } from "@/lib/analytics";

export type ReorderFlowProps = {
  /** The saved portrait being put back on something. Fixed for this whole flow. */
  artworkId: string;
  /** The portrait's style label, shown next to its thumbnail. */
  styleLabel: string;
  /** Short-lived signed URL for the watermarked preview, or null if we have none. */
  previewUrl: string | null;
};

function resolveSize(color: Variant, size: string | null): string | null {
  // A one-size product has nothing to choose, so it is settled from the start.
  if (color.sizes.length === 1) return color.sizes[0];
  return size && color.sizes.includes(size) ? size : null;
}

/**
 * The re-order island: a saved portrait already exists, so there is no upload and
 * no generation step. The customer only picks what to print it on. This owns the
 * product, colour and size selection and builds the cart line from the EXISTING
 * artworkId, then routes to the cart. It never calls /api/upload or /api/generate,
 * and spends no regeneration credit: the artwork is reused as-is, and fulfilment
 * (B3) draws a correctly sized print file per order item at checkout.
 *
 * Price is seeded from the chosen variant so the held cart is priced correctly;
 * checkout re-derives it server-side regardless.
 */
export function ReorderFlow({ artworkId, styleLabel, previewUrl }: ReorderFlowProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const [product, setProduct] = useState<Product>(PRODUCTS[0]);
  const [color, setColor] = useState<Variant>(PRODUCTS[0].variants[0]);
  const [size, setSize] = useState<string | null>(() =>
    resolveSize(PRODUCTS[0].variants[0], null),
  );

  const handleProductChange = (next: Product) => {
    if (next.slug === product.slug) return;
    const nextColor = next.variants[0];
    setProduct(next);
    setColor(nextColor);
    setSize(resolveSize(nextColor, null));
  };

  const handleColorChange = (nextColor: Variant) => {
    setColor(nextColor);
    // Keep a still-valid size; otherwise settle a one-size or clear it.
    setSize((current) => resolveSize(nextColor, current));
  };

  const canAddToCart = size !== null;

  const handleAddToCart = () => {
    if (!canAddToCart || size === null) return;
    addItem({
      productSlug: product.slug,
      color: color.color,
      size,
      qty: 1,
      // The saved portrait, reused as-is: no upload, no generation, no credit.
      artworkId,
      // Priced from the chosen variant; checkout re-derives server-side anyway.
      unitPriceZar: color.priceZar,
    });
    trackCreatureReordered({ product: product.slug });
    router.push("/cart");
  };

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      {/* The portrait being re-ordered, fixed for the flow. */}
      <div className="flex flex-col gap-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line bg-surface-alt">
          {previewUrl ? (
            // Plain img, not next/image: the source is a short-lived signed URL
            // that changes every hour, so there is nothing to cache and proxying
            // it would only leak it further. Same call the account cards make.
            //
            // contain, not cover: the plate is taller than this square box, so
            // cover would crop the arc and the name away. Same reasoning as the
            // account card, and the tint behind it is doing the same job.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${styleLabel} portrait`}
              className="h-full w-full object-contain p-3"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center text-muted"
            >
              Your portrait
            </div>
          )}
        </div>
        <p className="eyebrow text-[11px] text-accent">{styleLabel}</p>
      </div>

      {/* Pick what to print it on. */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-xs text-accent">Wear this again</p>
          <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
            Put them on something new.
          </h1>
          <p className="max-w-md leading-relaxed text-muted">
            No re-upload, no waiting for a new portrait. Choose a piece, a colour
            and a size, and this same portrait goes straight to your cart.
          </p>
        </div>

        {/* Product picker */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ink">Piece</p>
          <div className="flex flex-wrap gap-2">
            {PRODUCTS.map((option) => {
              const selected = option.slug === product.slug;
              return (
                <button
                  key={option.slug}
                  type="button"
                  onClick={() => handleProductChange(option)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                    selected
                      ? "border-ink bg-ink text-base"
                      : "border-line text-ink hover:bg-surface",
                  )}
                >
                  {option.name.replace(/^The /, "")}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-2xl font-medium text-ink">
          {formatZar(color.priceZar)}
        </p>

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
                  onClick={() => handleColorChange(variant)}
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
        </div>

        {/* Add to cart */}
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <Button
            block
            size="md"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            aria-disabled={!canAddToCart}
            className="w-full sm:w-auto"
          >
            Add to cart
          </Button>
          {!canAddToCart ? (
            <p className="text-sm text-muted">Choose a size to add to cart.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
