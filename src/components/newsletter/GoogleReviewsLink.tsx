import { Star } from "@phosphor-icons/react/dist/ssr";

/**
 * A small link out to the shop's Google reviews. It reads
 * NEXT_PUBLIC_GOOGLE_REVIEWS_URL and renders NOTHING when that is unset, so it
 * is safe to place in the layout before the owner has a Google Business Profile
 * URL to point at. Server-safe: no client hooks, just an env read at render.
 */
export function GoogleReviewsLink({ className }: { className?: string }) {
  const url = process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL?.trim();
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink ${
        className ?? ""
      }`}
    >
      <Star size={16} weight="regular" aria-hidden="true" className="text-accent" />
      Read our Google reviews
    </a>
  );
}
