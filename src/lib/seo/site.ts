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
 * uses. The footer, this constant and the email layer now all use the plural
 * brand spelling (hello@kindredcreatures.co.za). NOTE: the real domain still
 * needs owner confirmation before launch (item 4 in docs/design-tweaks.md).
 */
export const BRAND_EMAIL = "hello@kindredcreatures.co.za";

/**
 * Share-card imagery is intentionally absent for now. The storefront renders
 * hatched PhotoFrame placeholders rather than photographs, so there is no honest
 * image to hand a link preview: a fabricated stock shot would misrepresent the
 * product. OG/twitter cards therefore carry the title and description only.
 * When the real photography shoot lands, add an OG_IMAGE constant pointing at a
 * real 1200x630 asset and restore `images` in layout.tsx and the product page.
 */
