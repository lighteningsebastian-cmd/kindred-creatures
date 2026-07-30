import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { artworks, type Artwork } from "@/lib/db/schema";
import { getBreed, referenceKey } from "@/lib/breeds";
import {
  profileFromArtwork,
  readRevisions,
} from "@/lib/artwork-approval";
import { getImageProvider } from "@/lib/images";
import { sniffImageExtension, imageMimeForExtension } from "@/lib/images/detect";
import { backPlate, composePlate, frontPlate } from "@/lib/print/plate";
import { getProduct, printPixels } from "@/lib/products";
import { getStorage } from "@/lib/storage";

/**
 * Drawing the artwork, after payment.
 *
 * The model draws the animal; everything else on the garment is typeset by us
 * and composited around it. This is the step that produces the two plates the
 * customer approves, and the print file is later a resize of these exact bytes.
 *
 * TWO THINGS HERE MUST NEVER THROW, because a paid order is on the other end of
 * them: a breed with no reference illustration, and a failed drawing. The first
 * is an ordinary state (One of One has no reference by design, and the library
 * is being drawn breed by breed). The second gets one retry and then a flag for
 * a person. Neither may leave a customer who has paid with nothing.
 */

export type DrawResult =
  | { ok: true; artwork: Artwork; usedReference: boolean }
  | { ok: false; reason: string };

/** How many times we ask the model before handing it to a person. */
export const DRAW_ATTEMPTS = 2;

/** The left-chest plate as a fraction of the garment's full print width. */
export const FRONT_FRACTION = 1 / 3;

/**
 * Resolves the breed reference, or nothing at all.
 *
 * Returns null loudly rather than failing: an order must never fail because an
 * illustration has not been drawn yet.
 */
async function resolveReference(artwork: Artwork): Promise<string | null> {
  if (!artwork.breedId) return null;
  const breed = getBreed(artwork.breedId);
  if (!breed) return null;

  const key = referenceKey(breed);
  // One of One entries have no reference by design; their portrait comes from
  // the photograph alone, which is the correct answer for an animal that is
  // one of one.
  if (!key) return null;

  const bytes = await getStorage().getBytes(key);
  if (!bytes) {
    console.warn(
      `[drawing] no reference illustration stored for breed "${breed.id}" (${key}). Drawing from the photograph alone.`,
    );
    return null;
  }
  return key;
}

/**
 * Draws both sides for an artwork and composites them into the plates.
 *
 * @param artworkId the artwork to draw. Must already carry the companion
 * profile and the customer's photograph.
 * @returns the updated row, or a reason a person needs to look at it.
 */
export async function drawArtworkPlates(
  artworkId: string,
): Promise<DrawResult> {
  const db = await getDb();
  const [artwork] = await db
    .select()
    .from(artworks)
    .where(eq(artworks.id, artworkId));

  if (!artwork) return { ok: false, reason: "artwork-not-found" };
  if (!artwork.style) return { ok: false, reason: "no art style was chosen" };

  const product = getProduct(artwork.productSlug);
  if (!product) {
    return { ok: false, reason: `unknown product "${artwork.productSlug}"` };
  }

  const reference = await resolveReference(artwork);
  // Only ever our own sentences, and only from validated chips. What the
  // customer wrote is not here and never will be.
  const reasons = readRevisions(artwork).at(-1)?.reasons ?? [];

  let lastError = "";
  for (let attempt = 1; attempt <= DRAW_ATTEMPTS; attempt += 1) {
    try {
      const provider = await getImageProvider();

      // Face on, in colour, for the chest. The back is a side profile, which is
      // why it gets the breed reference as a second input: a profile has to be
      // invented from a face-on photograph, and the reference is what keeps it
      // breed-accurate rather than a guess.
      const front = await provider.generatePortrait({
        uploadKey: artwork.uploadKey,
        style: artwork.style,
        reasons,
      });
      const back = await provider.generatePortrait({
        uploadKey: artwork.uploadKey,
        style: artwork.style,
        reasons,
        referenceKey: reference,
      });

      const profile = profileFromArtwork(artwork);
      const { widthPx, heightPx } = printPixels(product);
      // The front is a left-chest patch, not a second full-size plate. There is
      // no chest dimension in products.ts yet, so it is expressed as a fraction
      // of the print width: about 93mm across on a hoodie, which is the usual
      // left-chest size. Confirm with the printer and move it into products.ts
      // when they give real numbers.
      const frontSize = Math.round(widthPx * FRONT_FRACTION);

      const frontBytes = await composePlate(
        frontPlate(profile, frontSize, frontSize),
        front.portraitBytes,
        frontSize,
        frontSize,
      );
      const backBytes = await composePlate(
        backPlate(profile, null, widthPx, heightPx),
        back.portraitBytes,
        widthPx,
        heightPx,
      );

      const stamp = Date.now();
      const ext = sniffImageExtension(frontBytes);
      const frontKey = `plates/${artworkId}/front-${stamp}.${ext}`;
      const backKey = `plates/${artworkId}/back-${stamp}.${ext}`;
      const mime = imageMimeForExtension(ext);
      await getStorage().put(frontKey, frontBytes, mime);
      await getStorage().put(backKey, backBytes, mime);

      // canonicalKey stays the portrait the print file is derived from. The
      // plates are what the customer approves; the print file is a resize of
      // the back plate's own bytes, never a second drawing.
      const canonicalKey = `portraits/${artworkId}/${stamp}.${ext}`;
      await getStorage().put(canonicalKey, backBytes, mime);

      const [row] = await db
        .update(artworks)
        .set({
          frontKey,
          backKey,
          canonicalKey,
          promptVersion: front.promptVersion,
          status: "ready",
        })
        .where(eq(artworks.id, artworkId))
        .returning();

      return {
        ok: true,
        artwork: row ?? artwork,
        usedReference: reference !== null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // One retry. Image APIs fail transiently often enough that giving up on
      // the first refusal would put paid orders in front of a person for no
      // reason.
      if (attempt < DRAW_ATTEMPTS) {
        console.warn(
          `[drawing] attempt ${attempt} failed for artwork ${artworkId}: ${lastError}. Retrying.`,
        );
      }
    }
  }

  console.error(
    `[drawing] artwork ${artworkId} could not be drawn after ${DRAW_ATTEMPTS} attempts: ${lastError}. A paid order is waiting on a person.`,
  );
  await db
    .update(artworks)
    .set({ status: "failed" })
    .where(eq(artworks.id, artworkId));

  return { ok: false, reason: lastError || "drawing failed" };
}
