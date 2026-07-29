import sharp from "sharp";
import {
  ART_STYLE_LABELS,
  type ArtStyle,
  type ImageProvider,
} from "./provider";

/**
 * Local, key-free provider. It draws a simple branded stand-in portrait per
 * style after a short delay that mimics a real generation, and approves any
 * non-empty upload. Good enough for the whole customizer flow to run end to end
 * offline; swap in the OpenAI provider for real portraits.
 *
 * IT MUST LIE ABOUT THE PICTURE, NEVER ABOUT THE FORMAT. The whole shop has to
 * run with an empty .env, which means this path is the one most of the codebase
 * is ever tested against. So the stand-in is a PNG with a genuinely transparent
 * background at the same size gpt-image-1 returns, because everything
 * downstream (the resize, the watermark, and the print compositor that will
 * later set type over the portrait) depends on real alpha. A mock that returned
 * an opaque rectangle would let a transparency bug reach a printed garment
 * before anyone saw it.
 */

/**
 * The size gpt-image-1 returns for our canonical render (see openai.ts). Matched
 * here so the mock exercises the same downscale and upscale arithmetic.
 */
const CANONICAL_WIDTH = 1024;
const CANONICAL_HEIGHT = 1536;

/** What the mock records in artworks.prompt_version: no prompt was ever used. */
export const MOCK_PROMPT_VERSION = "mock";

function latencyMs(): number {
  const override = process.env.MOCK_LATENCY_MS;
  if (override != null && override !== "") return Number(override);
  const isTest =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  return isTest ? 0 : 1500;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Palette-aligned ink per style (hex approximations of the design tokens).
// There is no background colour here on purpose: the background is nothing.
const STYLE_THEME: Record<ArtStyle, { ink: string; accent: string }> = {
  "classic-portrait": { ink: "#2c2620", accent: "#7c2f2f" },
  "line-sketch": { ink: "#2c2620", accent: "#3a332b" },
  watercolor: { ink: "#2c2620", accent: "#a97f4d" },
};

function pawGlyph(cx: number, cy: number, r: number, fill: string): string {
  const pad = r * 0.62;
  const toe = r * 0.34;
  return `
    <g fill="${fill}">
      <ellipse cx="${cx}" cy="${cy + r * 0.35}" rx="${r}" ry="${r * 0.85}"/>
      <circle cx="${cx - pad}" cy="${cy - r * 0.55}" r="${toe}"/>
      <circle cx="${cx - pad * 0.35}" cy="${cy - r * 0.95}" r="${toe}"/>
      <circle cx="${cx + pad * 0.35}" cy="${cy - r * 0.95}" r="${toe}"/>
      <circle cx="${cx + pad}" cy="${cy - r * 0.55}" r="${toe}"/>
    </g>`;
}

/**
 * Rasterised stand-ins, one per style. The mock draws the same picture every
 * time for a given style, so rasterising it once and handing the same bytes
 * back is exactly equivalent and keeps the offline path cheap: the test suite
 * runs this provider hundreds of times.
 */
const drawn = new Map<ArtStyle, Uint8Array>();

/**
 * The stand-in portrait, as PNG bytes with a transparent background.
 *
 * Note what is NOT here: no background rectangle and no border. Both would be
 * opaque, and an opaque stand-in would quietly hide exactly the defect this
 * mock exists to keep us honest about.
 */
async function drawPortrait(style: ArtStyle): Promise<Uint8Array> {
  const cached = drawn.get(style);
  if (cached) return cached;
  const png = await rasterise(style);
  drawn.set(style, png);
  return png;
}

async function rasterise(style: ArtStyle): Promise<Uint8Array> {
  const theme = STYLE_THEME[style];
  const label = ART_STYLE_LABELS[style].toUpperCase();
  const w = CANONICAL_WIDTH;
  const h = CANONICAL_HEIGHT;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${ART_STYLE_LABELS[style]} sample portrait">
  ${pawGlyph(w / 2, h * 0.42, w * 0.18, theme.accent)}
  <text x="50%" y="${h * 0.62}" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="${Math.round(w * 0.05)}" font-weight="900" letter-spacing="3" fill="${theme.ink}">${label}</text>
  <text x="50%" y="${h * 0.68}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(w * 0.035)}" fill="${theme.accent}">Kindred Creatures sample</text>
</svg>`;
  const png = await sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
  return new Uint8Array(png);
}

export class MockImageProvider implements ImageProvider {
  async moderate({
    bytes,
  }: {
    bytes: Uint8Array;
  }): Promise<{ ok: boolean; reason?: string }> {
    if (!bytes || bytes.length === 0) {
      return {
        ok: false,
        reason:
          "That file came through empty. Try uploading the photo again.",
      };
    }
    return { ok: true };
  }

  async generatePortrait({
    style,
  }: {
    uploadKey: string;
    style: ArtStyle;
  }): Promise<{ portraitBytes: Uint8Array; promptVersion: string }> {
    await delay(latencyMs());
    return {
      portraitBytes: await drawPortrait(style),
      promptVersion: MOCK_PROMPT_VERSION,
    };
  }
}
