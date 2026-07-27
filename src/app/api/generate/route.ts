import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { artworks } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { getImageProvider } from "@/lib/images";
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
 * Generates (or regenerates) a watermarked preview for an artwork in the chosen
 * style. Capped at three generations per artwork; the fourth is refused with a
 * clear 429. The high-res print file is produced later, post-payment.
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
    const { previewBytes } = await provider.generatePreview({
      uploadKey: artwork.uploadKey,
      style,
    });

    const ext = sniffImageExtension(previewBytes);
    const previewKey = `previews/${artworkId}/${Date.now()}.${ext}`;
    await getStorage().put(
      previewKey,
      previewBytes,
      imageMimeForExtension(ext),
    );

    const nextCount = artwork.regenCount + 1;
    await db
      .update(artworks)
      .set({ previewKey, regenCount: nextCount, status: "ready" })
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
