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
 *
 * THE PHOTOGRAPH IS OPTIONAL, as of 5 August, so that a customer can order
 * using the stock illustration of their breed. This is half one of that
 * change: the pipeline handles a null upload, and nothing in the interface
 * offers the option yet. It cannot until the reference illustration library
 * exists, because selling "a stock illustration of your breed" that is a
 * hatched placeholder is a refund. See docs/spec-portrait-prompting.md
 * section 6a for how the same gating is done for the prompt's REFERENCE clause.
 */

export type DrawResult =
  | { ok: true; artwork: Artwork; usedReference: boolean }
  | { ok: false; reason: string };

/** How many times we ask the model before handing it to a person. */
export const DRAW_ATTEMPTS = 2;

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
  // There is no style to check for any more: one house style, and the two
  // portraits are the two sides of the garment. The guard that used to stand
  // here would now refuse every order, since nothing writes artworks.style.

  const product = getProduct(artwork.productSlug);
  if (!product) {
    return { ok: false, reason: `unknown product "${artwork.productSlug}"` };
  }

  const reference = await resolveReference(artwork);

  // A NULL uploadKey is an ordinary case now: the customer ordered without a
  // photograph and took the stock illustration of their breed instead (owner,
  // 5 August), so the reference is the only input and the portrait is drawn
  // from it alone.
  //
  // Neither one is not. There is nothing to draw from, and asking the model
  // anyway returns a handsome generic example of the breed, which is exactly
  // what SUBJECT exists to prevent. Refused by name, before the retry loop:
  // two attempts at an impossible drawing is two API calls and four minutes to
  // reach the same answer.
  if (!artwork.uploadKey && !reference) {
    console.error(
      `[drawing] artwork ${artworkId} has neither a photograph nor a breed ` +
        `reference. A paid order is waiting on a person.`,
    );
    await db
      .update(artworks)
      .set({ status: "failed" })
      .where(eq(artworks.id, artworkId));
    return { ok: false, reason: "no photograph and no reference illustration" };
  }

  // Only ever our own sentences, and only from validated chips. What the
  // customer wrote is not here and never will be.
  const reasons = readRevisions(artwork).at(-1)?.reasons ?? [];

  let lastError = "";
  for (let attempt = 1; attempt <= DRAW_ATTEMPTS; attempt += 1) {
    try {
      const provider = await getImageProvider();

      // Face on, in colour, for the chest. The back is a graphite side profile,
      // which is why it gets the breed reference as a second input: a profile
      // has to be invented from a face-on photograph, and the reference is what
      // keeps it breed-accurate rather than a guess. The side is what decides
      // both the medium and the pose (lib/images/prompts.ts).
      const front = await provider.generatePortrait({
        uploadKey: artwork.uploadKey,
        side: "front",
        reasons,
      });
      const back = await provider.generatePortrait({
        uploadKey: artwork.uploadKey,
        side: "back",
        reasons,
        referenceKey: reference,
      });

      const profile = profileFromArtwork(artwork);
      const { widthPx, heightPx } = printPixels(product, "back");
      // The front is a left-chest patch with its OWN measured area, 110 by
      // 150mm (docs/spec-print-layout.md section 1). It used to be derived as a
      // third of the back's print width, which was both a different number and
      // a square, so the chest print was the wrong size and the wrong shape.
      const frontPx = printPixels(product, "front");

      const frontBytes = await composePlate(
        frontPlate(profile, frontPx.widthPx, frontPx.heightPx),
        front.portraitBytes,
        frontPx.widthPx,
        frontPx.heightPx,
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
