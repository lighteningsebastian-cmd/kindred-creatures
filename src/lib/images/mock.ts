import {
  ART_STYLE_LABELS,
  type ArtStyle,
  type ImageProvider,
} from "./provider";

/**
 * Local, key-free provider. It draws a simple branded stand-in portrait per
 * style (an SVG, so no rasteriser dependency) after a short delay that mimics a
 * real generation, and approves any non-empty upload. Good enough for the whole
 * customizer flow to run end to end offline; swap in the OpenAI provider for
 * real portraits.
 */

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

// Warm, palette-aligned backdrops per style (hex approximations of the tokens).
const STYLE_THEME: Record<ArtStyle, { bg: string; ink: string; accent: string }> =
  {
    "classic-portrait": { bg: "#efe9df", ink: "#2c2620", accent: "#7c2f2f" },
    "line-sketch": { bg: "#f3efe7", ink: "#2c2620", accent: "#3a332b" },
    watercolor: { bg: "#ece7dd", ink: "#2c2620", accent: "#a97f4d" },
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

function watermarkTiles(width: number, height: number): string {
  const text = "kindred creatures";
  const step = 150;
  const tiles: string[] = [];
  for (let y = 30; y < height; y += step) {
    for (let x = -40; x < width; x += 260) {
      tiles.push(
        `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2" fill="#2c2620" fill-opacity="0.12">${text}</text>`,
      );
    }
  }
  return tiles.join("");
}

function drawPortrait(
  style: ArtStyle,
  size: number,
  watermark: boolean,
): Uint8Array {
  const theme = STYLE_THEME[style];
  const label = ART_STYLE_LABELS[style].toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${ART_STYLE_LABELS[style]} sample portrait">
  <rect width="${size}" height="${size}" fill="${theme.bg}"/>
  <rect x="16" y="16" width="${size - 32}" height="${size - 32}" fill="none" stroke="${theme.ink}" stroke-opacity="0.35" stroke-width="2"/>
  ${pawGlyph(size / 2, size * 0.42, size * 0.12, theme.accent)}
  <text x="50%" y="${size * 0.68}" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="${Math.round(size * 0.05)}" font-weight="900" letter-spacing="3" fill="${theme.ink}">${label}</text>
  <text x="50%" y="${size * 0.75}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(size * 0.035)}" fill="${theme.accent}">Kindred Creatures sample</text>
  ${watermark ? watermarkTiles(size, size) : ""}
</svg>`;
  return new TextEncoder().encode(svg);
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

  async generatePreview({
    style,
  }: {
    uploadKey: string;
    style: ArtStyle;
  }): Promise<{ previewBytes: Uint8Array }> {
    await delay(latencyMs());
    return { previewBytes: drawPortrait(style, 512, true) };
  }

  async generatePrintFile({
    style,
    widthPx,
  }: {
    uploadKey: string;
    style: ArtStyle;
    widthPx: number;
    heightPx: number;
  }): Promise<{ printBytes: Uint8Array }> {
    await delay(latencyMs());
    // Print file is unwatermarked; size to the print area's larger edge.
    return { printBytes: drawPortrait(style, Math.max(widthPx, 512), false) };
  }
}
