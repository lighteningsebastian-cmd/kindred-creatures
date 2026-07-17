"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_QTY, MIN_QTY } from "@/lib/checkout";
import type { ProductSlug } from "@/lib/products";

/**
 * One line in the cart. `artworkId` is the line identity: every artwork is a
 * distinct commissioned portrait, so two lines can never share one. Adding the
 * same artwork again raises its quantity rather than opening a second line.
 *
 * `unitPriceZar` is captured at add time (whole rands, not cents) so a later
 * price change cannot silently re-price a cart someone is already holding.
 * The thumbnail is NOT stored here: signed asset URLs expire, so the cart asks
 * /api/artwork/[id]/preview for a fresh one at render time.
 */
export interface CartItem {
  productSlug: ProductSlug;
  color: string;
  size: string;
  qty: number;
  artworkId: string;
  unitPriceZar: number;
}

// Re-exported so cart consumers keep importing their bounds from the cart. The
// definition lives in checkout.ts, which the server can import without dragging
// this "use client" module across the boundary.
export { MIN_QTY, MAX_QTY };

/** Quantities live in 1..10; anything outside is pulled back to the edge. */
export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return MIN_QTY;
  return Math.min(MAX_QTY, Math.max(MIN_QTY, Math.floor(qty)));
}

export type CartState = {
  items: CartItem[];
  /** Adds a line, or raises the quantity of the line with this artworkId. */
  addItem: (item: CartItem) => void;
  removeItem: (artworkId: string) => void;
  /** Sets a line's quantity (clamped 1..10). A quantity of 0 removes it. */
  setQty: (artworkId: string, qty: number) => void;
  clear: () => void;
};

/** Versioned so a future change to CartItem can drop stale carts cleanly. */
export const CART_STORAGE_KEY = "kindred-cart-v1";

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (line) => line.artworkId === item.artworkId,
          );
          if (!existing) {
            return { items: [...state.items, { ...item, qty: clampQty(item.qty) }] };
          }
          return {
            items: state.items.map((line) =>
              line.artworkId === item.artworkId
                ? { ...line, qty: clampQty(line.qty + clampQty(item.qty)) }
                : line,
            ),
          };
        }),

      removeItem: (artworkId) =>
        set((state) => ({
          items: state.items.filter((line) => line.artworkId !== artworkId),
        })),

      setQty: (artworkId, qty) =>
        set((state) => {
          if (qty <= 0) {
            return {
              items: state.items.filter((line) => line.artworkId !== artworkId),
            };
          }
          return {
            items: state.items.map((line) =>
              line.artworkId === artworkId ? { ...line, qty: clampQty(qty) } : line,
            ),
          };
        }),

      clear: () => set({ items: [] }),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 1,
      // Guarded getter: there is no localStorage on the server, and zustand
      // treats a throwing getter as "no storage" and skips persistence.
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      // The store must render the same on the server and on the client's first
      // pass, so rehydration is deferred to an effect (see useCartHydrated).
      skipHydration: true,
    },
  ),
);

// ---------------------------------------------------------------------------
// Derived values (pure, so they can be reasoned about and tested directly)
// ---------------------------------------------------------------------------

/** Total number of garments in the cart, counting quantities. */
export function itemCount(items: CartItem[]): number {
  return items.reduce((sum, line) => sum + line.qty, 0);
}

/** Cart subtotal in whole rands, excluding shipping. */
export function subtotalZar(items: CartItem[]): number {
  return items.reduce((sum, line) => sum + line.qty * line.unitPriceZar, 0);
}

// ---------------------------------------------------------------------------
// Hydration-safe hooks
// ---------------------------------------------------------------------------

const EMPTY: CartItem[] = [];

let rehydrationStarted = false;

function subscribeToHydration(onChange: () => void): () => void {
  const stopHydrate = useCartStore.persist.onHydrate(onChange);
  const stopFinish = useCartStore.persist.onFinishHydration(onChange);
  return () => {
    stopHydrate();
    stopFinish();
  };
}

/**
 * True once the persisted cart has been read back from localStorage.
 *
 * The server snapshot is pinned to false and rehydration is deferred to an
 * effect, so the server markup and the client's first pass agree and React
 * hydration cannot mismatch. The cart then fills in on the next commit.
 * Consumers use this to hold back a count or a line list until the real one is
 * known, rather than flashing an empty cart at someone who has one.
 */
export function useCartHydrated(): boolean {
  useEffect(() => {
    if (rehydrationStarted) return;
    rehydrationStarted = true;
    void useCartStore.persist.rehydrate();
  }, []);

  return useSyncExternalStore(
    subscribeToHydration,
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}

/** The cart's lines, empty until the persisted cart has been read back. */
export function useCartItems(): CartItem[] {
  const hydrated = useCartHydrated();
  const items = useCartStore((state) => state.items);
  return hydrated ? items : EMPTY;
}

/** Live item count for the nav badge. Reads 0 until hydration settles. */
export function useCartItemCount(): number {
  return itemCount(useCartItems());
}

/** Live subtotal in whole rands. Reads 0 until hydration settles. */
export function useCartSubtotalZar(): number {
  return subtotalZar(useCartItems());
}
