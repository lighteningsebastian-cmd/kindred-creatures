import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { artworks } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { getImageProvider } from "@/lib/images";
import { getProduct } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // ~10MB
const ACCEPTED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
]);

function bad(error: string, status: number) {
  return Response.json({ error }, { status });
}

/**
 * Accepts a pet photo, screens it for moderation, and (if clean) stores it and
 * opens an artwork record. Rejected photos create no record and return 422 with
 * a friendly reason the UI can show inline.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("Expected a multipart form upload.", 400);
  }

  const file = form.get("file");
  const productSlug = String(form.get("productSlug") ?? "");

  if (!getProduct(productSlug)) {
    return bad("Unknown product.", 400);
  }
  if (!(file instanceof File)) {
    return bad("Please choose a photo to upload.", 400);
  }

  const ext = ACCEPTED.get(file.type);
  if (!ext) {
    return bad(
      "That file type is not supported. Use a JPEG, PNG, WebP or HEIC photo.",
      415,
    );
  }
  if (file.size === 0) {
    return bad("That file came through empty. Try again.", 400);
  }
  if (file.size > MAX_BYTES) {
    return bad("That photo is over 10MB. Please choose a smaller one.", 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const provider = await getImageProvider();
  const verdict = await provider.moderate({ bytes });
  if (!verdict.ok) {
    // No artwork row is created for a rejected upload.
    return bad(
      verdict.reason ??
        "We could not accept this photo. Please try a different one.",
      422,
    );
  }

  const artworkId = randomUUID();
  const uploadKey = `uploads/${artworkId}/original.${ext}`;
  await getStorage().put(uploadKey, bytes, file.type);

  const db = await getDb();
  await db.insert(artworks).values({
    id: artworkId,
    uploadKey,
    productSlug,
    status: "uploaded",
  });

  return Response.json({ artworkId, uploadKey }, { status: 201 });
}
