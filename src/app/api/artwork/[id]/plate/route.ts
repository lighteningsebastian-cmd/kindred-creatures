import { eq } from "drizzle-orm";
import { profileFromArtwork } from "@/lib/artwork-approval";
import { isProfileComplete } from "@/lib/companion";
import { getDb } from "@/lib/db/client";
import { artworks } from "@/lib/db/schema";
import { backPlate } from "@/lib/print/plate";
import { getProduct } from "@/lib/products";

// opentype outlines the type against the font binaries in assets/fonts, which
// needs a real filesystem.
export const runtime = "nodejs";
// The profile can be edited after a line is in the cart, and the thumbnail has
// to follow it. Nothing here is expensive enough to be worth caching stale.
export const dynamic = "force-dynamic";

/** The coordinate space the plate is set in. It is vector; this is only shape. */
const PLATE_WIDTH_PX = 900;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return Response.json({ error: "Not found." }, { status: 404 });
}

/**
 * The back plate for an artwork, as SVG, drawn from the companion profile.
 *
 * WHY THIS IS NOT THE ROUTE THAT WAS JUST DELETED. `/preview` signed a URL for
 * `artworks.previewKey`, a column nothing writes since generation moved after
 * payment, so it 404d every time. This route renders from `creatureName`,
 * `species`, `breedId`, `temperament` and `togetherSince`, which are written
 * before the money is taken and are the only inputs the plate has ever had. It
 * is answering with something we hold rather than asking for something we
 * deliberately have not made.
 *
 * NOTHING IS STORED. `backPlate` is the same typesetting the print file is
 * composed from, and running it costs a row read and a few milliseconds. A
 * saved snapshot would be one more thing to invalidate the moment somebody
 * corrects their dog's name, which is exactly how the old thumbnail rotted.
 *
 * The portrait rectangle comes back empty on purpose: at this point the drawing
 * has not happened and by design will not until after payment. What the
 * customer sees is their own words, set the way they will be printed.
 *
 * ON ACCESS. The artwork id is the whole of the key, the same posture the old
 * preview route had, and the plate carries a pet's name and a year. A uuid is
 * unguessable and the cart holds nothing else to authenticate with, but this is
 * the reason for `no-store` below: it must not sit in a shared cache.
 */
export async function GET(
  _request: Request,
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

  if (!artwork) return notFound();

  const profile = profileFromArtwork(artwork);
  // A half-answered profile makes a half-empty plate, which reads as a fault
  // rather than as an unfinished form. The cart falls back to the garment
  // photograph on a 404, which is a picture of something real.
  if (!isProfileComplete(profile)) return notFound();

  // The plate's shape follows the garment the artwork was started on. A reorder
  // can put this artwork on a different product whose back area is a slightly
  // different ratio, and that is not worth a query parameter: the four back
  // areas sit within a few percent of each other and the thumbnail letterboxes
  // either way.
  const area = getProduct(artwork.productSlug)?.printArea.back;
  if (!area) return notFound();

  const { svg } = backPlate(
    profile,
    // No reference code: no order exists yet, and a made-up number on an
    // otherwise honest plate is the one thing that must not appear.
    null,
    PLATE_WIDTH_PX,
    Math.round((PLATE_WIDTH_PX * area.heightMm) / area.widthMm),
  );

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
