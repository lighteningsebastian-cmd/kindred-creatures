/**
 * The seam between the customizer and whatever draws the portraits. Everything
 * upstream (routes, UI, DB) speaks only to this interface, so the mock and the
 * real OpenAI provider are drop-in interchangeable and the whole flow runs
 * locally with no API keys.
 */

export type ArtStyle = "classic-portrait" | "line-sketch" | "watercolor";

export const ART_STYLES: ArtStyle[] = [
  "classic-portrait",
  "line-sketch",
  "watercolor",
];

/** Human-facing labels for each style (used by the UI and mock artwork). */
export const ART_STYLE_LABELS: Record<ArtStyle, string> = {
  "classic-portrait": "Classic portrait",
  "line-sketch": "Line sketch",
  watercolor: "Watercolor",
};

export function isArtStyle(value: unknown): value is ArtStyle {
  return (
    typeof value === "string" && (ART_STYLES as string[]).includes(value)
  );
}

export interface ImageProvider {
  /** Screens an uploaded photo. Returns ok:false with a friendly reason to reject. */
  moderate(input: { bytes: Uint8Array }): Promise<{ ok: boolean; reason?: string }>;
  /** Produces a screen-resolution, watermarked preview for the chosen style. */
  generatePreview(input: {
    uploadKey: string;
    style: ArtStyle;
  }): Promise<{ previewBytes: Uint8Array }>;
  /** Produces the high-resolution, unwatermarked file for printing. */
  generatePrintFile(input: {
    uploadKey: string;
    style: ArtStyle;
    widthPx: number;
    heightPx: number;
  }): Promise<{ printBytes: Uint8Array }>;
}
