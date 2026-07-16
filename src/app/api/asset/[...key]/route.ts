import { getStorage, isAssetTokenValid } from "@/lib/storage";

export const runtime = "nodejs";
// Reads are per-request and token-gated; never cache.
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
};

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Serves a stored asset when the request carries a valid, unexpired signature.
 * The signature binds the exact key to an expiry, so links cannot be forged or
 * replayed once they lapse.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await ctx.params;
  const key = segments.join("/");

  const url = new URL(request.url);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";

  if (!isAssetTokenValid(key, exp, sig)) {
    return Response.json(
      { error: "This link is invalid or has expired." },
      { status: 403 },
    );
  }

  const bytes = await getStorage().getBytes(key);
  if (!bytes) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(key),
      "Cache-Control": "private, max-age=60",
    },
  });
}
