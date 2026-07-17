"use client";

import { useEffect } from "react";
import { trackViewItem } from "@/lib/analytics";

/**
 * Fires view_item once when a product page mounts. A tiny client island so the
 * product page itself can stay a server component. Inert when analytics is off.
 */
export function TrackProductView({
  slug,
  priceZar,
}: {
  slug: string;
  priceZar: number;
}) {
  useEffect(() => {
    trackViewItem({ slug, priceZar });
  }, [slug, priceZar]);

  return null;
}
