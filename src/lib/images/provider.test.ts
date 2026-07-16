import { describe, it, expect, afterEach, vi } from "vitest";
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

  it("generatePreview returns non-empty SVG bytes", async () => {
    const provider = new MockImageProvider();
    const { previewBytes } = await provider.generatePreview({
      uploadKey: "uploads/x.png",
      style: "watercolor",
    });
    expect(previewBytes.length).toBeGreaterThan(0);
    expect(sniffImageExtension(previewBytes)).toBe("svg");
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
      widthPx: 3307,
      heightPx: 4134,
    });
    const preview = new TextDecoder().decode(previewBytes);
    const print = new TextDecoder().decode(printBytes);
    expect(preview).toContain("kindred creatures");
    expect(print).not.toContain("kindred creatures");
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
