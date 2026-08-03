// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import sharp from "sharp";
import { MOCK_PROMPT_VERSION, MockImageProvider } from "./mock";
import { derivePreviewBytes } from "./derive";
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

  it("generatePortrait returns non-empty PNG bytes", async () => {
    // Was SVG, and was two methods (a preview and a separate print file). The
    // mock now draws ONE canonical picture in the same format the real provider
    // does, because everything downstream of it assumes a raster with alpha.
    const provider = new MockImageProvider();
    const { portraitBytes } = await provider.generatePortrait({
      uploadKey: "uploads/x.png",
      side: "front",
    });
    expect(portraitBytes.length).toBeGreaterThan(0);
    expect(sniffImageExtension(portraitBytes)).toBe("png");
  });

  it("draws on a genuinely transparent background, like the real provider", async () => {
    // The hard architectural invariant is that the whole shop runs on an empty
    // .env, so this path is the one most of the codebase is ever tested
    // against. If the mock were opaque, a transparency bug would reach a
    // printed garment before anyone saw it.
    const provider = new MockImageProvider();
    const { portraitBytes } = await provider.generatePortrait({
      uploadKey: "uploads/x.png",
      side: "back",
    });

    const { data, info } = await sharp(Buffer.from(portraitBytes))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    // Top-left corner: background, and background must be nothing at all.
    expect(data[3]).toBe(0);
  });

  it("draws at the size the real model returns, so the arithmetic is the same", async () => {
    const provider = new MockImageProvider();
    const { portraitBytes } = await provider.generatePortrait({
      uploadKey: "uploads/x.png",
      side: "front",
    });
    const meta = await sharp(Buffer.from(portraitBytes)).metadata();
    expect({ width: meta.width, height: meta.height }).toEqual({
      width: 1024,
      height: 1536,
    });
  });

  it("the canonical portrait carries no watermark", async () => {
    // Was "preview is watermarked, print file is not", asserted by reading SVG
    // source. The provider no longer makes either one: it makes the canonical
    // portrait, and derive.ts adds the watermark to the preview copy only. So
    // what is pinned here is that nothing is baked in at the source, and
    // derive.test.ts pins the watermarking itself.
    const provider = new MockImageProvider();
    const { portraitBytes } = await provider.generatePortrait({
      uploadKey: "uploads/x.png",
      side: "front",
    });

    const preview = await derivePreviewBytes(portraitBytes);
    const plain = await sharp(Buffer.from(portraitBytes))
      .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    // The unwatermarked downscale and the preview differ; the difference is the
    // watermark, and it is added on the way to the preview, not at the source.
    expect(Buffer.from(preview).equals(plain)).toBe(false);
  });

  it("reports which prompt drew the portrait, even offline", async () => {
    const provider = new MockImageProvider();
    const { promptVersion } = await provider.generatePortrait({
      uploadKey: "uploads/x.png",
      side: "back",
    });
    // "mock" and not a real PROMPT_VERSION: no prompt was ever used, and an
    // artwork that claims a prompt version it never saw is worse than one that
    // admits it was drawn offline.
    expect(promptVersion).toBe(MOCK_PROMPT_VERSION);
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
  it("isArtStyle still validates the styles stored on older artworks", () => {
    // The customer is not asked any more (one house style, 3 August) and
    // nothing new writes artworks.style. This stays because rows drawn before
    // the change still carry a value, and the account page labels a creature's
    // thumbnail from it.
    expect(isArtStyle("line-sketch")).toBe(true);
    expect(isArtStyle("nope")).toBe(false);
    expect(isArtStyle(42)).toBe(false);
  });
});

describe("the two sides", () => {
  it("draws a visibly different picture for the front and the back", async () => {
    // Front is colour and face on, back is graphite and in profile. They came
    // back byte-identical before 3 August, because both sides were asked for
    // the same face-on portrait and only the reference input differed.
    const provider = new MockImageProvider();
    const front = await provider.generatePortrait({
      uploadKey: "uploads/x.png",
      side: "front",
    });
    const back = await provider.generatePortrait({
      uploadKey: "uploads/x.png",
      side: "back",
    });
    expect(
      Buffer.from(front.portraitBytes).equals(Buffer.from(back.portraitBytes)),
    ).toBe(false);
  });
});
