"use client";

import { Minus, Plus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatZar, getProduct, type ProductSlug } from "@/lib/products";
import {
  MAX_QTY,
  MIN_QTY,
  subtotalZar,
  useCartHydrated,
  useCartItems,
  useCartStore,
} from "@/lib/cart-store";

function productName(slug: ProductSlug): string {
  return getProduct(slug)?.name ?? slug;
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
 * The cart screen: one line per commissioned portrait, with the artwork itself
 * as the thumbnail. Lines are keyed by artworkId, so the quantity stepper and
 * the remove control both address a portrait rather than a product.
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
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface sm:h-28 sm:w-28">
                        {/* Stable path that re-signs per request: a stored
                            signed URL would expire inside a saved cart. Plain
                            img keeps the next/image loader off a redirect. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/artwork/${item.artworkId}/preview`}
                          alt={`Your portrait for the ${name}`}
                          className="h-full w-full object-cover"
                        />
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
                  Placeholder: shipping is not costed yet while we confirm rates
                  with our print shop, so this total covers the garments only.
                  Orders over R750 ship free.
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
