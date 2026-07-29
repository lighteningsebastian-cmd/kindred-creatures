import sharp from "sharp";

/**
 * Everything we make FROM the portrait, rather than the portrait itself.
 *
 * The model draws exactly once per artwork. Those bytes are canonical: the
 * preview the customer approves and the print file the shop receives are both
 * derived from them here, so the only differences between what was approved and
 * what gets printed are scale and a watermark. See
 * docs/spec-portrait-prompting.md section 1 for why that matters more than
 * anything else in this pipeline.
 *
 * TRANSPARENCY IS LOAD BEARING. The portrait prints directly onto the garment
 * colour, so every function here outputs PNG and every one of them keeps the
 * alpha channel intact. A resize that flattens alpha onto white would print as a
 * white rectangle with an animal in it, and nobody would notice until a hoodie
 * came back from the printer.
 */

/**
 * The longest edge of a customer-facing preview, in pixels. Big enough to judge
 * a likeness on a phone, small enough that it is not a free print file.
 */
export const PREVIEW_MAX_PX = 768;

/** Fully transparent, for padding and for backgrounds that must not exist. */
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 } as const;

/**
 * The tiled diagonal watermark, drawn to fill a picture of the given size.
 *
 * It is deliberately quiet: it has to be legible enough that the preview is not
 * a usable file on its own, and light enough that a customer can still judge
 * whether the portrait looks like their animal.
 */
function watermarkSvg(width: number, height: number): Buffer {
  const text = "kindred creatures";
  const rowStep = Math.max(48, Math.round(height / 8));
  const colStep = Math.max(120, Math.round(width / 3));
  const fontSize = Math.max(11, Math.round(width / 34));
  const tiles: string[] = [];
  for (let y = rowStep / 2; y < height + rowStep; y += rowStep) {
    for (let x = -colStep / 3; x < width + colStep; x += colStep) {
      tiles.push(
        `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="2" fill="#2c2620" fill-opacity="0.16">${text}</text>`,
      );
    }
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${tiles.join("")}</svg>`,
  );
}

/**
 * The customer-facing preview: a downscaled, watermarked copy of the canonical
 * bytes and nothing else. No second trip to the model, so what is approved here
 * is what the print file is made from.
 *
 * The watermark is composited `atop`, meaning it lands only where the portrait
 * is actually drawn. Transparent areas stay perfectly transparent, so the
 * preview shows the same silhouette the garment will.
 *
 * @param canonicalBytes the stored canonical portrait.
 * @returns PNG bytes, alpha intact.
 */
export async function derivePreviewBytes(
  canonicalBytes: Uint8Array,
): Promise<Uint8Array> {
  const downscaled = await sharp(Buffer.from(canonicalBytes))
    .resize({
      width: PREVIEW_MAX_PX,
      height: PREVIEW_MAX_PX,
      fit: "inside",
      withoutEnlargement: true,
      background: TRANSPARENT,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const { width = PREVIEW_MAX_PX, height = PREVIEW_MAX_PX } =
    await sharp(downscaled).metadata();

  const watermarked = await sharp(downscaled)
    .composite([{ input: watermarkSvg(width, height), blend: "atop" }])
    .png()
    .toBuffer();

  return new Uint8Array(watermarked);
}

/**
 * The print file: the same canonical bytes at the garment's print area, with no
 * watermark on them.
 *
 * `contain` rather than `fill` on purpose. The portrait's shape and the print
 * area's shape are not the same, and stretching an animal to fit a hoodie is a
 * wrong-looking dog. It is padded with transparency instead, which prints as
 * nothing at all.
 *
 * Resolution is bounded by what the model gave us: the canonical image is
 * smaller than a 300 DPI print area, so this is an upscale. It is still the
 * right thing to do, because the alternative is drawing a second, different
 * animal at fulfilment time.
 *
 * @param canonicalBytes the stored canonical portrait.
 * @param widthPx the product's print width, from printPixels().
 * @param heightPx the product's print height, from printPixels().
 * @returns PNG bytes at exactly widthPx by heightPx, alpha intact.
 */
export async function derivePrintBytes(
  canonicalBytes: Uint8Array,
  widthPx: number,
  heightPx: number,
): Promise<Uint8Array> {
  const printed = await sharp(Buffer.from(canonicalBytes))
    .resize({
      width: widthPx,
      height: heightPx,
      fit: "contain",
      position: "centre",
      background: TRANSPARENT,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  return new Uint8Array(printed);
}
