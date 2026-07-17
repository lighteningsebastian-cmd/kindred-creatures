"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/analytics";

/**
 * Fires purchase, once, for an order whose payment the server has confirmed.
 *
 * This is mounted only by the paid branch of the order page, which renders on
 * the status the DATABASE reports, written only by the verified PayFast ITN.
 * Landing on this URL is not a sale; the server having seen a real payment is.
 * So purchase can never fire on a browser return alone.
 *
 * orderRef and totalZar only, no customer detail: an order reference is not
 * PII, a name or an email is. GA dedups repeat views on transaction_id.
 */
export function TrackPurchase({
  orderRef,
  totalZar,
}: {
  orderRef: string;
  totalZar: number;
}) {
  useEffect(() => {
    trackPurchase({ orderRef, totalZar });
  }, [orderRef, totalZar]);

  return null;
}
