// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import sharp from "sharp";
import { MockImageProvider } from "./mock";
import { sniffImageExtension } from "./detect";
import { isArtStyle } from "./provider";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("mock image provider", () => {
  it("moderate rejects empty bytes with a friendly reason", async () => {
    const provider = new MockImageProvider();
    const result = await provider.moderate({ bytes: new Uint8Array() });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("moderate accepts non-empty bytes", async () => {
    const provider = new MockImageProvider();
    const result = await provider.moderate({ bytes: new Uint8Array([1, 2, 3]) });
    expect(result.ok).toBe(true);
  });

  it("generatePreview returns non-empty PNG bytes", async () => {
    // Was SVG. The mock now returns the same format the real provider does,
    // because everything downstream of it assumes a raster image with alpha.
    const provider = new MockImageProvider();
    const { previewBytes } = await provider.generatePreview({
      uploadKey: "uploads/x.png",
      style: "watercolor",
    });
    expect(previewBytes.length).toBeGreaterThan(0);
    expect(sniffImageExtension(previewBytes)).toBe("png");
  });

  it("draws on a genuinely transparent background, like the real provider", async () => {
    // The hard architectural invariant is that the whole shop runs on an empty
    // .env, so this path is the one most of the codebase is ever tested
    // against. If the mock were opaque, a transparency bug would reach a
    // printed garment before anyone saw it.
    const provider = new MockImageProvider();
    const { printBytes } = await provider.generatePrintFile({
      uploadKey: "uploads/x.png",
      style: "line-sketch",
      widthPx: 600,
      heightPx: 800,
    });

    const { data, info } = await sharp(Buffer.from(printBytes))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    // Top-left corner: background, and background must be nothing at all.
    expect(data[3]).toBe(0);
  });

  it("preview is watermarked, print file is not", async () => {
    const provider = new MockImageProvider();
    const { previewBytes } = await provider.generatePreview({
      uploadKey: "uploads/x.png",
      style: "classic-portrait",
    });
    const { printBytes } = await provider.generatePrintFile({
      uploadKey: "uploads/x.png",
      style: "classic-portrait",
      widthPx: 1024,
      heightPx: 1536,
    });

    // Both are rasters now, so the watermark is asserted in pixels rather than
    // in SVG source: the preview differs from a plain downscale of the same
    // portrait, and the print file is byte-identical to a plain resize of it.
    const canonical = await sharp(Buffer.from(printBytes)).png().toBuffer();
    const plainPreview = await sharp(canonical)
      .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    expect(Buffer.from(previewBytes).equals(plainPreview)).toBe(false);
  });
});

describe("provider selection", () => {
  it("selects the mock when MOCK_SERVICES is true", async () => {
    vi.resetModules();
    process.env.MOCK_SERVICES = "true";
    process.env.OPENAI_API_KEY = "sk-should-be-ignored";
    const { getImageProvider, usingMockProvider } = await import("./index");
    expect(usingMockProvider()).toBe(true);
    const provider = await getImageProvider();
    // resetModules gives the imported class a fresh identity, so compare by name.
    expect(provider.constructor.name).toBe("MockImageProvider");
  });

  it("selects the mock when no OPENAI_API_KEY is set", async () => {
    vi.resetModules();
    delete process.env.MOCK_SERVICES;
    delete process.env.OPENAI_API_KEY;
    const { usingMockProvider } = await import("./index");
    expect(usingMockProvider()).toBe(true);
  });

  it("does not select the mock when a key is set and mock is off", async () => {
    vi.resetModules();
    delete process.env.MOCK_SERVICES;
    process.env.OPENAI_API_KEY = "sk-real";
    const { usingMockProvider } = await import("./index");
    expect(usingMockProvider()).toBe(false);
  });
});

describe("style helpers", () => {
  it("isArtStyle validates known styles", () => {
    expect(isArtStyle("line-sketch")).toBe(true);
    expect(isArtStyle("nope")).toBe(false);
    expect(isArtStyle(42)).toBe(false);
  });
});
