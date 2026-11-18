"use client";

import { useEffect } from "react";
import { trackViewItem } from "@/lib/analytics";
import type { Fit } from "@/lib/products";

/**
 * Fires view_item once when a product page mounts. A tiny client island so the
 * product page itself can stay a server component. Inert when analytics is off.
 */
export function TrackProductView({
  slug,
  fit,
  priceZar,
}: {
  slug: string;
  /** The fit the page resolved, from ?fit= or the product's first. */
  fit: Fit;
  priceZar: number;
}) {
  useEffect(() => {
    trackViewItem({ slug, fit, priceZar });
  }, [slug, fit, priceZar]);

  return null;
}
