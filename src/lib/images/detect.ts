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
