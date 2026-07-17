/**
 * The site's public origin, and how to build absolute URLs from it.
 *
 * Same env var and same localhost fallback as payfast.ts and email/index.ts, so
 * a dev box with no NEXT_PUBLIC_SITE_URL set still builds. In production the var
 * is set and every canonical, sitemap entry and JSON-LD @id resolves against it.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || "http://localhost:3000").replace(/\/+$/, "");
}

/** Joins a site-relative path onto the origin: "/products/tee" => "https://.../products/tee". */
export function absoluteUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return suffix === "/" ? siteUrl() : `${siteUrl()}${suffix}`;
}

/** The brand's name, used verbatim in titles, JSON-LD and llms.txt. */
export const BRAND_NAME = "Kindred Creatures";

/**
 * Where customer mail actually lands. This is the reply-to default in
 * .env.example, which is the operative address the transactional email system
 * uses. NOTE: the footer currently shows hello@kindredcreature.co.za (singular);
 * that inconsistency is item 4 in docs/design-tweaks.md and is not settled here.
 * When it is settled, this constant and the footer must agree.
 */
export const BRAND_EMAIL = "hello@kindredcreatures.co.za";

/**
 * The share card image, and the one the site falls back on when a page has no
 * shot of its own. This is the hero photograph at OG proportions: the same
 * seeded image the landing page renders, so what a link preview shows is what
 * the page shows.
 *
 * It is placeholder stock, like every photograph on the site right now (see
 * docs/design-tweaks.md). When real photography lands, this points at it.
 */
export const OG_IMAGE =
  "https://picsum.photos/seed/golden-retriever-owner-hug/1200/630";

export const OG_IMAGE_ALT =
  "A person holding their golden retriever close, both looking calm and content";
