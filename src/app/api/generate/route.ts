import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { artworks } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { getImageProvider } from "@/lib/images";
import { derivePreviewBytes } from "@/lib/images/derive";
import { isArtStyle } from "@/lib/images/provider";
import {
  imageMimeForExtension,
  sniffImageExtension,
} from "@/lib/images/detect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGEN_CAP = 3;
const PREVIEW_TTL_SEC = 60 * 60; // 1 hour

function bad(error: string, status: number) {
  return Response.json({ error }, { status });
}

/**
 * Draws (or redraws) an artwork's portrait in the chosen style. Capped at three
 * per artwork; the fourth is refused with a clear 429.
 *
 * THE MODEL IS CALLED ONCE HERE AND NOWHERE ELSE IN THE SHOP.
 *
 * Those bytes are stored whole, at full size and unwatermarked, as the
 * artwork's canonical image. What comes back to the browser is a downscaled,
 * watermarked copy of THAT FILE, and the print file made after payment is a
 * resize of the same one. So the portrait a customer approves is, to the pixel
 * and apart from scale, the portrait that reaches the garment.
 *
 * It used to work the other way: this route drew one picture and fulfilment
 * drew a second one at print size. Image models are not deterministic, so the
 * second picture was a different animal in the same style, and the customer
 * received a portrait they had never seen. See
 * docs/spec-portrait-prompting.md section 1.
 *
 * "Try another" REPLACES the canonical image. The last portrait made before
 * checkout is the one that ships.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Expected a JSON body.", 400);
  }

  const { artworkId, style } = (body ?? {}) as {
    artworkId?: unknown;
    style?: unknown;
  };

  if (typeof artworkId !== "string" || artworkId.length === 0) {
    return bad("artworkId is required.", 400);
  }
  if (!isArtStyle(style)) {
    return bad("Choose one of the available styles.", 400);
  }

  const db = await getDb();
  const [artwork] = await db
    .select()
    .from(artworks)
    .where(eq(artworks.id, artworkId))
    .limit(1);

  if (!artwork) {
    return bad("We could not find that upload. Please start again.", 404);
  }

  if (artwork.regenCount >= REGEN_CAP) {
    return bad(
      `You have used all ${REGEN_CAP} portrait tries for this photo. Upload a new photo to start over.`,
      429,
    );
  }

  await db
    .update(artworks)
    .set({ status: "generating", style })
    .where(eq(artworks.id, artworkId));

  try {
    const provider = await getImageProvider();
    const { portraitBytes, promptVersion } = await provider.generatePortrait({
      uploadKey: artwork.uploadKey,
      style,
    });

    // The canonical bytes, stored first and stored whole. Everything the
    // customer and the print shop ever see comes out of this one file, so it is
    // written before anything is derived from it: a preview whose canonical
    // image failed to store is a preview we could never honour.
    const stamp = Date.now();
    const canonicalExt = sniffImageExtension(portraitBytes);
    const canonicalKey = `portraits/${artworkId}/${stamp}.${canonicalExt}`;
    await getStorage().put(
      canonicalKey,
      portraitBytes,
      imageMimeForExtension(canonicalExt),
    );

    // The preview: the same bytes, smaller, with a watermark on them.
    const previewBytes = await derivePreviewBytes(portraitBytes);
    const ext = sniffImageExtension(previewBytes);
    const previewKey = `previews/${artworkId}/${stamp}.${ext}`;
    await getStorage().put(
      previewKey,
      previewBytes,
      imageMimeForExtension(ext),
    );

    const nextCount = artwork.regenCount + 1;
    await db
      .update(artworks)
      .set({
        canonicalKey,
        promptVersion,
        previewKey,
        regenCount: nextCount,
        status: "ready",
      })
      .where(eq(artworks.id, artworkId));

    const previewUrl = await getStorage().getSignedUrl(
      previewKey,
      PREVIEW_TTL_SEC,
    );

    return Response.json({
      previewUrl,
      regenCount: nextCount,
      remaining: REGEN_CAP - nextCount,
    });
  } catch {
    await db
      .update(artworks)
      .set({ status: "failed" })
      .where(eq(artworks.id, artworkId));
    return bad(
      "Something went wrong making that portrait. Please try again.",
      500,
    );
  }
}
