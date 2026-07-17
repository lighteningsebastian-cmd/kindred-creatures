import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Routes no crawler should be fetching. Each of these is either somebody's
 * private data, per-visitor state, or not a page at all.
 *
 * The admin and order pages also set robots: { index: false } in their own
 * metadata. That is not redundancy for its own sake: robots.txt is a request
 * that a crawler is free to ignore, and the meta tag is the second lock. Note
 * the order of operations though, a disallowed page is never fetched, so its
 * meta noindex is never read. That is fine for these routes, which are already
 * behind auth or an unguessable token and are not in the sitemap either.
 */
export const DISALLOWED_PATHS = [
  "/admin",
  "/admin/login",
  "/admin/orders/",
  "/order/",
  "/cart",
  "/checkout",
  "/dev/",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: DISALLOWED_PATHS,
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
