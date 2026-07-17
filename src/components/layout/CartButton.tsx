"use client";

import { useState } from "react";
import Link from "next/link";
import { CartDog } from "@/components/creatures/CartDog";
import { useCartHydrated, useCartItemCount } from "@/lib/cart-store";

/**
 * Cart entry point. A dog lives in the basket: it peeks out on hover/focus
 * and pops up when the count increases. The button box stays fixed at 40px;
 * the head overflows upward without any layout shift.
 *
 * The count comes from the persisted cart, which is only readable once the
 * client has rehydrated. Remounting the dog at that moment reseeds its "count
 * went up" baseline, so a page load with a full cart does not read as an add
 * and set the dog off; real adds still pop.
 */
export type CartButtonProps = {
  /**
   * Overrides the live cart count. Only for demos and stories that drive the
   * dog by hand (see /dev/creatures); real chrome reads the store.
   */
  count?: number;
};

export function CartButton({ count: countOverride }: CartButtonProps = {}) {
  const [engaged, setEngaged] = useState(false);
  const storeCount = useCartItemCount();
  const hydrated = useCartHydrated();

  const count = countOverride ?? storeCount;

  const hasItems = count > 0;
  const label = hasItems
    ? `Cart, ${count} item${count === 1 ? "" : "s"}`
    : "Cart, empty";

  return (
    <Link
      href="/cart"
      aria-label={label}
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-[transform,background-color] hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
    >
      <CartDog
        key={hydrated ? "live" : "pending"}
        count={count}
        engaged={engaged}
      />
    </Link>
  );
}
