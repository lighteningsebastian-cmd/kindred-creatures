/**
 * Sniffs an image byte payload to a file extension. Providers return raw bytes
 * (the mock draws SVG, OpenAI returns PNG); the routes use this to name the
 * storage key so the asset route can serve the right content type.
 */
export function sniffImageExtension(bytes: Uint8Array): string {
  if (bytes.length >= 8) {
    // PNG magic number.
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return "png";
    }
    // JPEG.
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "jpg";
    }
  }
  // SVG / XML text payloads.
  const head = new TextDecoder()
    .decode(bytes.subarray(0, 64))
    .trimStart()
    .toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "svg";
  return "bin";
}

/**
 * The MIME type for an extension from {@link sniffImageExtension}.
 *
 * This exists because `image/${ext}` is WRONG for two of the four cases it has
 * to cover: an SVG is `image/svg+xml` (never `image/svg`) and a JPEG is
 * `image/jpeg` (never `image/jpg`). A browser handed `image/svg` renders a
 * broken-image icon rather than the picture.
 *
 * The bug is invisible in development because the local storage adapter serves
 * bytes through /api/asset, which derives the type from the key's extension via
 * its own correct table. Vercel Blob serves whatever type was set at PUT time,
 * so a wrong value here only ever breaks production.
 */
export function imageMimeForExtension(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
