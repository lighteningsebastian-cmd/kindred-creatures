// @vitest-environment node
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { PREVIEW_MAX_PX, derivePreviewBytes, derivePrintBytes } from "./derive";
import { sniffImageExtension } from "./detect";

/**
 * The two derivations that stand between an approved portrait and a printed
 * garment. Everything here is about two properties: the bytes come from the
 * canonical image and nowhere else, and the alpha channel survives.
 *
 * A resize that flattens transparency onto white is invisible on screen and
 * catastrophic on a Stone hoodie, which is why it is asserted at every step
 * rather than assumed.
 */

/** A canonical portrait the way the model returns one: PNG, transparent, tall. */
async function canonicalPortrait(width = 1024, height = 1536): Promise<Uint8Array> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <circle cx="${width / 2}" cy="${height / 2}" r="${width / 3}" fill="#7c2f2f"/>
    </svg>`,
  );
  return new Uint8Array(await sharp(svg).png().toBuffer());
}

/** The alpha value of one pixel, 0 fully transparent and 255 fully opaque. */
async function alphaAt(
  bytes: Uint8Array,
  x: number,
  y: number,
): Promise<number> {
  const { data, info } = await sharp(Buffer.from(bytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * info.channels;
  return data[index + info.channels - 1];
}

describe("derivePreviewBytes", () => {
  it("is a downscale of the canonical bytes, as a PNG", async () => {
    const canonical = await canonicalPortrait();
    const preview = await derivePreviewBytes(canonical);

    expect(sniffImageExtension(preview)).toBe("png");
    const meta = await sharp(Buffer.from(preview)).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(PREVIEW_MAX_PX);
    // Smaller than the canonical image: a preview is not a free print file.
    expect(preview.length).toBeLessThan(canonical.length);
  });

  it("keeps the transparent background transparent", async () => {
    const canonical = await canonicalPortrait();
    const preview = await derivePreviewBytes(canonical);

    const meta = await sharp(Buffer.from(preview)).metadata();
    expect(meta.hasAlpha).toBe(true);
    // The top-left corner is background in the fixture and must stay nothing at
    // all, rather than becoming white pixels.
    expect(await alphaAt(preview, 0, 0)).toBe(0);
    // The middle is the subject and must still be there.
    expect(
      await alphaAt(preview, Math.floor(meta.width! / 2), Math.floor(meta.height! / 2)),
    ).toBe(255);
  });

  it("is watermarked: it differs from a plain downscale of the same bytes", async () => {
    const canonical = await canonicalPortrait();
    const preview = await derivePreviewBytes(canonical);

    const plain = await sharp(Buffer.from(canonical))
      .resize({
        width: PREVIEW_MAX_PX,
        height: PREVIEW_MAX_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    expect(Buffer.from(preview).equals(plain)).toBe(false);
  });

  it("does not enlarge a canonical image smaller than the preview box", async () => {
    const small = await canonicalPortrait(200, 300);
    const preview = await derivePreviewBytes(small);
    const meta = await sharp(Buffer.from(preview)).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(300);
  });
});

describe("derivePrintBytes", () => {
  it("resizes the canonical bytes to exactly the product's print area", async () => {
    const canonical = await canonicalPortrait();
    const print = await derivePrintBytes(canonical, 3307, 4134);

    expect(sniffImageExtension(print)).toBe("png");
    const meta = await sharp(Buffer.from(print)).metadata();
    expect(meta.width).toBe(3307);
    expect(meta.height).toBe(4134);
  });

  it("keeps real transparency rather than white pixels", async () => {
    const canonical = await canonicalPortrait();
    const print = await derivePrintBytes(canonical, 600, 800);

    const meta = await sharp(Buffer.from(print)).metadata();
    expect(meta.hasAlpha).toBe(true);
    expect(await alphaAt(print, 0, 0)).toBe(0);
    expect(await alphaAt(print, 300, 400)).toBe(255);
  });

  it("pads rather than stretches when the shapes disagree", async () => {
    // The canonical portrait is 2:3 and this print area is 1:1. Stretching the
    // animal to fit would be a wrong-looking dog, so it is centred and the rest
    // is transparency, which prints as nothing.
    const canonical = await canonicalPortrait();
    const print = await derivePrintBytes(canonical, 900, 900);

    const meta = await sharp(Buffer.from(print)).metadata();
    expect(meta.width).toBe(900);
    expect(meta.height).toBe(900);
    // Left edge, vertically centred: padding, so fully transparent.
    expect(await alphaAt(print, 2, 450)).toBe(0);
    // Centre: the subject.
    expect(await alphaAt(print, 450, 450)).toBe(255);
  });

  it("carries no watermark: the shop prints what the customer bought", async () => {
    const canonical = await canonicalPortrait();
    const print = await derivePrintBytes(canonical, 1024, 1536);

    const plain = await sharp(Buffer.from(canonical))
      .resize({
        width: 1024,
        height: 1536,
        fit: "contain",
        position: "centre",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .ensureAlpha()
      .png()
      .toBuffer();

    expect(Buffer.from(print).equals(plain)).toBe(true);
  });
});
