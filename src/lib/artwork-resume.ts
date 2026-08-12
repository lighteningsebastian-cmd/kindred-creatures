import { eq } from "drizzle-orm";
import { profileFromArtwork } from "@/lib/artwork-approval";
import type { CompanionProfile } from "@/lib/companion";
import { getDb } from "@/lib/db/client";
import { artworks } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

/** Long enough to finish an edit, short enough that a copied link dies. */
const PHOTO_TTL_SEC = 30 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A piece already in somebody's cart, opened back up to be changed. */
export interface ResumedArtwork {
  artworkId: string;
  profile: CompanionProfile;
  /** A signed URL for the photo they already sent, or null if there is none. */
  photoUrl: string | null;
}

/**
 * Reopens an artwork so the flow can be entered with every answer still in it.
 *
 * This is what makes a cart line editable without the cart growing an editor of
 * its own. Everything the customer told us about their creature is already on
 * the row; the only two things it does not know are the colourway and the size,
 * which the cart carries and hands over in the URL.
 *
 * RETURNS NULL RATHER THAN THROWING on anything unexpected: an id that is not a
 * uuid, an artwork that no longer exists, one drawn for a different garment
 * than the page being opened. A stale link in somebody's cart should put them
 * at the start of a fresh piece, which is a page that works, not on an error.
 *
 * ON ACCESS. The artwork id is the whole of the key, the same posture the plate
 * thumbnail takes. What it opens is the customer's own answers about their own
 * animal, in a form, and the photograph is behind a signed URL that expires.
 * Nothing here can be paid for or printed: the checkout re-derives every amount
 * server-side and the drawing runs off the row, not off this page.
 */
export async function resumeArtwork(
  artworkId: string | undefined,
  productSlug: string,
): Promise<ResumedArtwork | null> {
  if (!artworkId || !UUID_RE.test(artworkId)) return null;

  const db = await getDb();
  const [artwork] = await db
    .select()
    .from(artworks)
    .where(eq(artworks.id, artworkId))
    .limit(1);

  if (!artwork) return null;
  // The plate is cut for one garment's print area. Opening a hoodie's artwork
  // on the tee page would put its answers behind the wrong shape.
  if (artwork.productSlug !== productSlug) return null;

  let photoUrl: string | null = null;
  if (artwork.uploadKey) {
    try {
      photoUrl = await getStorage().getSignedUrl(
        artwork.uploadKey,
        PHOTO_TTL_SEC,
      );
    } catch {
      // Storage having a bad day is not a reason to refuse the edit. They lose
      // the thumbnail of their own photo, not the photo: the row still points
      // at it and the drawing still reads it.
      photoUrl = null;
    }
  }

  return {
    artworkId: artwork.id,
    profile: profileFromArtwork(artwork),
    photoUrl,
  };
}
