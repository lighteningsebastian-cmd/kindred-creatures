"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { GarmentSide } from "@/lib/garments";
import {
  PRODUCTS,
  formatZar,
  type PrintArea,
  type Product,
  type Variant,
} from "@/lib/products";
import { useCartStore } from "@/lib/cart-store";
import { trackCreatureReordered } from "@/lib/analytics";
import { GarmentPreview } from "./GarmentPreview";

export type ReorderFlowProps = {
  /** The saved portrait being put back on something. Fixed for this whole flow. */
  artworkId: string;
  /** The portrait's style label, shown above the preview. */
  styleLabel: string;
  /** Short-lived signed URL for the finished front plate, or null. */
  frontUrl: string | null;
  /** Short-lived signed URL for the finished back plate, or null. */
  backUrl: string | null;
};

/**
 * The plate they are buying again, in the shape it will print at.
 *
 * The box is the CHOSEN product's print area and the plate is contained in it,
 * which is exactly what the print file does (derivePrintBytes resizes with fit
 * "contain"): a portrait drawn for a tee and put on a hoodie keeps its own
 * proportions inside the hoodie's slightly different area. So what this shows
 * is what the new garment's print file will be.
 */
function FinishedPlate({
  url,
  area,
  alt,
}: {
  url: string | null;
  area: PrintArea;
  alt: string;
}) {
  const shape = { aspectRatio: `${area.widthMm} / ${area.heightMm}` };

  if (!url) {
    // Garment-shaped, not square: the garment is still shown, with the place
    // the plate will go marked out on it.
    return (
      <div
        role="img"
        aria-label="Where your portrait goes"
        className="flex w-full items-center justify-center rounded-sm border border-dashed border-line-strong bg-base/60"
        style={shape}
      />
    );
  }

  return (
    <div className="relative w-full" style={shape}>
      {/*
        Plain img, not next/image: the source is a short-lived signed URL that
        changes every hour, so there is nothing to cache and proxying it would
        only leak it further. Same call the account cards make.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}

function resolveSize(color: Variant, size: string | null): string | null {
  // A one-size product has nothing to choose, so it is settled from the start.
  if (color.sizes.length === 1) return color.sizes[0];
  return size && color.sizes.includes(size) ? size : null;
}

/**
 * The re-order island: a saved portrait already exists, so there is no upload and
 * no generation step. The customer only picks what to print it on, and SEES it
 * on that: the garment photograph follows the piece and colour pickers, with the
 * finished plate placed on it by the same component the customizer uses. This owns the
 * product, colour and size selection and builds the cart line from the EXISTING
 * artworkId, then routes to the cart. It never calls /api/upload or /api/generate,
 * and spends no regeneration credit: the artwork is reused as-is, and fulfilment
 * (B3) draws a correctly sized print file per order item at checkout.
 *
 * Price is seeded from the chosen variant so the held cart is priced correctly;
 * checkout re-derives it server-side regardless.
 */
export function ReorderFlow({
  artworkId,
  styleLabel,
  frontUrl,
  backUrl,
}: ReorderFlowProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const [product, setProduct] = useState<Product>(PRODUCTS[0]);
  const [color, setColor] = useState<Variant>(PRODUCTS[0].variants[0]);
  const [size, setSize] = useState<string | null>(() =>
    resolveSize(PRODUCTS[0].variants[0], null),
  );
  // The back by default: the plate is what they are buying again, and the back
  // is where it lives.
  const [side, setSide] = useState<GarmentSide>("back");

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
    <div className="grid gap-6 md:grid-cols-2 md:items-start md:gap-14">
      {/*
        The portrait on the garment being chosen. On a phone it holds a fixed
        third of the screen just under the sticky site header (Nav's 68px), and
        the pickers scroll beneath it, so changing a colour is something you
        watch happen rather than scroll back up to check. It never pushes the
        pickers off the screen.
      */}
      <div
        className={
          "sticky top-[68px] z-10 -mx-4 flex flex-col gap-3 bg-base px-4 pb-4 pt-2 " +
          "md:top-24 md:mx-0 md:px-0 md:pb-0 md:pt-0"
        }
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow text-[11px] text-accent">{styleLabel}</p>
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

        <div className="h-[34svh] md:h-[70vh]">
          <GarmentPreview product={product} color={color} side={side}>
            <FinishedPlate
              url={side === "back" ? backUrl : frontUrl}
              area={product.printArea[side]}
              alt={`Your portrait on the ${side} of ${product.name}`}
            />
          </GarmentPreview>
        </div>

        <p className="hidden text-sm text-muted md:block">
          {product.name} in {color.color}
        </p>
      </div>

      {/*
        Pick what to print it on. On a phone these scroll under the pinned
        preview, so anything the browser scrolls into view (a focused swatch, a
        Tab press) is told to stop below it rather than behind it: the header,
        the preview's third of the screen and its toggle row.
      */}
      <div
        className={
          "flex flex-col gap-6 " +
          "[&_button]:scroll-mt-[calc(34svh+10rem)] md:[&_button]:scroll-mt-28"
        }
      >
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
