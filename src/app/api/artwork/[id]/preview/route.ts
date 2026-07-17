import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { artworks } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
// Every hit mints a fresh signature; caching one would defeat the expiry.
export const dynamic = "force-dynamic";

/** Long enough to load a cart page, short enough that a leaked link dies fast. */
const PREVIEW_TTL_SEC = 5 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return Response.json({ error: "Not found." }, { status: 404 });
}

/**
 * Redirects to a freshly signed URL for an artwork's preview image.
 *
 * The cart stores only the artworkId, never a signed URL: signatures expire in
 * an hour but a persisted cart outlives that easily, so a stored URL would rot
 * into a broken thumbnail. This indirection is stable, so cart lines can point
 * at it forever and each render lands on a live signature.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound();

  const db = await getDb();
  const [artwork] = await db
    .select()
    .from(artworks)
    .where(eq(artworks.id, id))
    .limit(1);

  if (!artwork?.previewKey) return notFound();

  const signed = await getStorage().getSignedUrl(
    artwork.previewKey,
    PREVIEW_TTL_SEC,
  );

  // The local adapter hands back a root-relative path; the blob adapter hands
  // back an absolute URL. Resolving against the request covers both.
  return Response.redirect(new URL(signed, request.url), 302);
}
