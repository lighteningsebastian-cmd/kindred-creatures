import type { ProductSlug } from "@/lib/products";

/**
 * TEMPORARY handoff between the customizer and the cart.
 *
 * Task 5 introduces the real Zustand cart store and will REPLACE this module.
 * Until then the customizer parks the finished selection in localStorage under
 * a single, small, typed shape so the /cart page (Task 5) can pick it up. Keep
 * this surface tiny and the shape stable; do not grow it.
 */
export interface PendingCartItem {
  productSlug: ProductSlug;
  color: string;
  size: string;
  artworkId: string;
}

const STORAGE_KEY = "kindred:pending-cart";

export function setPendingCartItem(item: PendingCartItem): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
  } catch {
    // localStorage can be unavailable (private mode, quota); a failed handoff
    // is non-fatal here and Task 5 will harden this path.
  }
}

export function getPendingCartItem(): PendingCartItem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingCartItem) : null;
  } catch {
    return null;
  }
}

export function clearPendingCartItem(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
