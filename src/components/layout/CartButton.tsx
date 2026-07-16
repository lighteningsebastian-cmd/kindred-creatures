"use client";

import { useState } from "react";
import Link from "next/link";
import { CartDog } from "@/components/creatures/CartDog";

export type CartButtonProps = {
  count?: number;
};

/**
 * Cart entry point. A dog lives in the basket: it peeks out on hover/focus
 * and pops up when the count increases. The button box stays fixed at 40px;
 * the head overflows upward without any layout shift.
 */
export function CartButton({ count = 0 }: CartButtonProps) {
  const [engaged, setEngaged] = useState(false);
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
      <CartDog count={count} engaged={engaged} />
    </Link>
  );
}
