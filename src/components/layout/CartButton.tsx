"use client";

import Link from "next/link";
import { Basket } from "@phosphor-icons/react";

export type CartButtonProps = {
  count?: number;
};

/**
 * Cart entry point. Kept as its own small client component so a later task can
 * wrap it with an animated shell without touching Nav. Renders an icon and a
 * count badge slot; the badge only appears when there is at least one item.
 */
export function CartButton({ count = 0 }: CartButtonProps) {
  const hasItems = count > 0;
  const label = hasItems
    ? `Cart, ${count} item${count === 1 ? "" : "s"}`
    : "Cart, empty";

  return (
    <Link
      href="/cart"
      aria-label={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-[transform,background-color] hover:bg-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
    >
      <Basket weight="regular" size={22} />
      {hasItems ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-btn px-1 text-[11px] font-semibold leading-[18px] text-base"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
