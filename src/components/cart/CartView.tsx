"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { FREE_SHIPPING_THRESHOLD_ZAR } from "@/lib/checkout";
import { garmentImageUrl } from "@/lib/garments";
import { formatZar, getProduct, type ProductSlug } from "@/lib/products";
import {
  MAX_QTY,
  MIN_QTY,
  subtotalZar,
  useCartHydrated,
  useCartItems,
  useCartStore,
  type CartItem,
} from "@/lib/cart-store";

function productName(slug: ProductSlug): string {
  return getProduct(slug)?.name ?? slug;
}

/** The chosen colourway's own colour, for a garment with no photograph. */
function swatchHex(slug: ProductSlug, color: string): string | undefined {
  return getProduct(slug)?.variants.find((v) => v.color === color)?.colorHex;
}

/**
 * The picture on a cart line: the plate they built, set the way it prints.
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
 */
function CartThumbnail({
  item,
  productLabel,
}: {
  item: CartItem;
  productLabel: string;
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
      sizes="112px"
      className="object-cover"
    />
  ) : (
    // No photograph for this garment yet (the tote). Its own colour, rather
    // than an empty frame.
    <div className="absolute inset-0" style={{ backgroundColor: swatch }} />
  );
}

/** Placeholder while the persisted cart is being read back on the client. */
function CartSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      {[0, 1].map((row) => (
        <div key={row} className="flex gap-4 border-b border-line pb-6">
          <Skeleton className="h-24 w-24 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-3 py-1">
            <Skeleton className="h-5 w-2/5 rounded-md" />
            <Skeleton className="h-4 w-1/4 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-start gap-5 rounded-lg border border-line bg-surface p-8 md:p-12">
      <p className="eyebrow text-xs text-accent">Nothing in here yet</p>
      <h2 className="max-w-lg font-display text-2xl leading-[1.2] text-ink md:text-3xl">
        Your cart is waiting for a face it knows.
      </h2>
      <p className="max-w-lg leading-relaxed text-muted">
        Pick a garment, upload the photo that captures your creature best, and we
        will draw their portrait before you decide anything.
      </p>
      <Button block href="/products/hoodie" size="md">
        Start a portrait
      </Button>
    </div>
  );
}

/**
 * The cart screen: one line per commissioned portrait, thumbnailed by the
 * garment in the colourway they chose. Lines are keyed by artworkId, so the
 * quantity stepper and the remove control both address a portrait rather than
 * a product.
 */
export function CartView() {
  const items = useCartItems();
  const hydrated = useCartHydrated();
  const setQty = useCartStore((state) => state.setQty);
  const removeItem = useCartStore((state) => state.removeItem);

  const subtotal = subtotalZar(items);

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-xs text-muted">Your cart</p>
          <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
            Ready when you are
          </h1>
        </div>

        <div className="mt-10">
          {!hydrated ? (
            <CartSkeleton />
          ) : items.length === 0 ? (
            <EmptyCart />
          ) : (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
              <ul className="flex flex-col border-t border-line">
                {items.map((item) => {
                  const name = productName(item.productSlug);
                  const describe = `${name}, ${item.color}, size ${item.size}`;
                  return (
                    <li
                      key={item.artworkId}
                      className="flex gap-4 border-b border-line py-6 sm:gap-6"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface sm:h-28 sm:w-28">
                        <CartThumbnail item={item} productLabel={name} />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="font-display text-lg leading-snug text-ink sm:text-xl">
                              {name}
                            </h2>
                            <p className="mt-1 text-sm text-muted">
                              {item.color} · Size {item.size}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                              {formatZar(item.unitPriceZar)} each
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-medium text-ink sm:text-base">
                            {formatZar(item.qty * item.unitPriceZar)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                          <div className="inline-flex items-center rounded-md border border-line">
                            <button
                              type="button"
                              aria-label={`Decrease quantity of ${describe}`}
                              disabled={item.qty <= MIN_QTY}
                              onClick={() => setQty(item.artworkId, item.qty - 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-l-md text-ink transition-[background-color,transform] hover:bg-surface active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                            >
                              <Minus size={14} />
                            </button>
                            <span
                              aria-live="polite"
                              className="min-w-8 text-center text-sm font-medium tabular-nums text-ink"
                            >
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase quantity of ${describe}`}
                              disabled={item.qty >= MAX_QTY}
                              onClick={() => setQty(item.artworkId, item.qty + 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-r-md text-ink transition-[background-color,transform] hover:bg-surface active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove ${describe} from your cart`}
                            onClick={() => removeItem(item.artworkId)}
                            className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                          >
                            <X size={14} />
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <aside className="h-fit rounded-lg border border-line bg-surface p-6 lg:sticky lg:top-24">
                <h2 className="eyebrow text-xs text-muted">Order summary</h2>

                <dl className="mt-5 flex flex-col gap-3 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Subtotal</dt>
                    <dd className="font-medium text-ink">
                      {formatZar(subtotal)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Shipping</dt>
                    <dd className="text-muted">Added at checkout</dd>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
                    <dt className="font-medium text-ink">Total</dt>
                    <dd className="text-lg font-medium text-ink">
                      {formatZar(subtotal)}
                    </dd>
                  </div>
                </dl>

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  This total covers the garments. Shipping is added at checkout,
                  and it is free once your order passes{" "}
                  {formatZar(FREE_SHIPPING_THRESHOLD_ZAR)}.
                </p>

                <Button block href="/checkout" size="md" className="mt-6 w-full">
                  Checkout
                </Button>
              </aside>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
