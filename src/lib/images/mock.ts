import sharp from "sharp";
import type { ImageProvider } from "./provider";
import type { PortraitSide } from "./prompts";

/**
 * Local, key-free provider. It draws a simple branded stand-in portrait per
 * side after a short delay that mimics a real generation, and approves any
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

// Palette-aligned ink per side (hex approximations of the design tokens). The
// front is the colour portrait and the back is graphite, so the stand-ins carry
// that difference too: a mock where both sides look identical would let a
// front/back mix-up reach a printed garment unnoticed.
// There is no background colour here on purpose: the background is nothing.
const SIDE_THEME: Record<PortraitSide, { ink: string; accent: string }> = {
  front: { ink: "#2c2620", accent: "#7c2f2f" },
  back: { ink: "#2c2620", accent: "#5a5550" },
};

const SIDE_LABELS: Record<PortraitSide, string> = {
  front: "Front portrait",
  back: "Back profile",
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
 * Rasterised stand-ins, one per side. The mock draws the same picture every
 * time for a given side, so rasterising it once and handing the same bytes
 * back is exactly equivalent and keeps the offline path cheap: the test suite
 * runs this provider hundreds of times.
 */
const drawn = new Map<PortraitSide, Uint8Array>();

/**
 * The stand-in portrait, as PNG bytes with a transparent background.
 *
 * Note what is NOT here: no background rectangle and no border. Both would be
 * opaque, and an opaque stand-in would quietly hide exactly the defect this
 * mock exists to keep us honest about.
 */
async function drawPortrait(side: PortraitSide): Promise<Uint8Array> {
  const cached = drawn.get(side);
  if (cached) return cached;
  const png = await rasterise(side);
  drawn.set(side, png);
  return png;
}

async function rasterise(side: PortraitSide): Promise<Uint8Array> {
  const theme = SIDE_THEME[side];
  const label = SIDE_LABELS[side].toUpperCase();
  const w = CANONICAL_WIDTH;
  const h = CANONICAL_HEIGHT;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${SIDE_LABELS[side]} sample portrait">
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

  // referenceKey and standoutDetail are accepted and ignored: the stand-in
  // draws the same paw whatever it is handed, and the point is that the seam
  // exists. uploadKey is nullable for the same reason: a customer may order
  // without a photograph.
  //
  // Nothing offline can tell you whether the standout detail helps or hurts a
  // portrait. That needs a live key and the protocol in
  // docs/spec-portrait-prompting.md section 6.
  async generatePortrait({
    side,
  }: {
    uploadKey: string | null;
    side: PortraitSide;
    standoutDetail?: string | null;
  }): Promise<{ portraitBytes: Uint8Array; promptVersion: string }> {
    await delay(latencyMs());
    return {
      portraitBytes: await drawPortrait(side),
      promptVersion: MOCK_PROMPT_VERSION,
    };
  }
}
