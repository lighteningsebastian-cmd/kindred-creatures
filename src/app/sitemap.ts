import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/lib/products";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * The sitemap is a set of promises to a crawler: every URL in here exists, is
 * indexable, and is worth fetching. So it lists only public marketing and
 * product routes.
 *
 * Deliberately absent, and they must stay absent:
 *   /admin, /admin/login, /admin/orders/*  one person's dashboard, behind auth
 *   /order/*                               one customer's order, token-scoped
 *   /cart, /checkout                       per-visitor state, nothing to index
 *   /dev/*                                 internal component demos
 *   /api/*                                 not pages
 *   /customize/[slug]                      no longer a page: it permanently
 *                                          redirects (308) into /products/[slug],
 *                                          which is the canonical entry point.
 *                                          A redirect target belongs in no
 *                                          sitemap, and it stays crawlable (not
 *                                          disallowed in robots.txt) so a crawler
 *                                          can follow the 308 and update its
 *                                          index to the product page.
 *
 * lastModified is the build timestamp. It is honest for this codebase: the copy
 * is compiled in, so the only moment any of these pages can change is a deploy.
 * A route whose content starts coming from a database (S10's /journal) should
 * carry that row's real updated_at instead.
 */
const BUILD_TIME = new Date();

interface StaticRoute {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}

/**
 * Static routes that exist today.
 *
 * SEAM FOR S10: /about, /faq and /journal are yours to build. When each page
 * lands, add it here. They are not listed yet on purpose: a sitemap entry for a
 * page that 404s teaches a crawler that our sitemap lies, which is a worse
 * outcome than being crawled a day later. sitemap.test.ts asserts that every
 * static route in this list has a real page file on disk, so an entry added
 * before its page will fail the suite rather than ship.
 *
 *   { path: "/about", changeFrequency: "yearly", priority: 0.5 },
 *   { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
 *   { path: "/journal", changeFrequency: "weekly", priority: 0.5 },
 *
 * A /journal with individual posts wants its post URLs in here too, generated
 * from wherever the posts live, the way products are generated below.
 */
export const STATIC_ROUTES: StaticRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  // The shop is the catalogue hub: a real page (asserted by sitemap.test.ts),
  // ranked just under the homepage and above the individual product pages.
  { path: "/shop", changeFrequency: "weekly", priority: 0.9 },
  // The full how-it-works trust page (P3): a real page with HowTo + FAQ
  // structured data, ranked alongside the shop as a top-of-funnel hub.
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.7 },
  // S10 content pages. Each has a real page file on disk (asserted by
  // sitemap.test.ts) before earning its place here.
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/journal", changeFrequency: "weekly", priority: 0.5 },
  // The policy pages. Low priority, but listed rather than hidden: shipping,
  // returns and contact are read before a first order is placed, and a crawler
  // that cannot find them cannot show them to somebody deciding whether to
  // trust a shop they have never heard of.
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/shipping-and-returns", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: BUILD_TIME,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Generated from the product catalogue, so adding a fifth product to
  // products.ts puts it in the sitemap without anyone remembering to.
  const productEntries = PRODUCTS.map((product) => ({
    url: absoluteUrl(`/products/${product.slug}`),
    lastModified: BUILD_TIME,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
