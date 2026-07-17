"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";

/**
 * Empties the cart, once, on an order whose payment we have actually confirmed.
 *
 * The cart survives the whole way to PayFast on purpose (see CheckoutForm):
 * someone who takes one look at the gateway and backs out has to come back to
 * their portraits. So this is the other end of that decision, and it is
 * mounted only by the confirmed branch of the order page, which renders on a
 * status the DATABASE reports rather than on the customer having arrived here.
 * Landing on this URL is not payment; the server having seen a verified ITN is.
 *
 * Rehydrate first, then clear. The cart is persisted with skipHydration, so the
 * nav's cart badge kicks off its own read of localStorage on every page. Clear
 * before that read lands and it repopulates from storage a moment later.
 */
export function ClearCartOnPaid() {
  useEffect(() => {
    void Promise.resolve(useCartStore.persist.rehydrate()).then(() => {
      useCartStore.getState().clear();
    });
  }, []);

  return null;
}
