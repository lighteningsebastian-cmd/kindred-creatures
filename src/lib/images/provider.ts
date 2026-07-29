/**
 * The seam between the customizer and whatever draws the portraits. Everything
 * upstream (routes, UI, DB) speaks only to this interface, so the mock and the
 * real OpenAI provider are drop-in interchangeable and the whole flow runs
 * locally with no API keys.
 */

import type { RevisionReason } from "@/lib/revision";

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
  /**
   * Draws the CANONICAL portrait: one call to the model, at the largest size it
   * supports, unwatermarked, on a transparent background.
   *
   * THIS IS THE ONLY METHOD THAT DRAWS ANYTHING, and it is called exactly once
   * per portrait the customer keeps. The preview they approve and the print file
   * the shop receives are both derived from these bytes by images/derive.ts, so
   * the only differences between the two are scale and a watermark.
   *
   * There is deliberately no second method for the print file. Image models are
   * not deterministic: a second call at a bigger size does not return a larger
   * version of the same picture, it returns a DIFFERENT picture of the same
   * animal, and the customer would receive a portrait they never approved. That
   * defect shipped in this interface once already. See
   * docs/spec-portrait-prompting.md section 1.
   */
  generatePortrait(input: {
    uploadKey: string;
    style: ArtStyle;
    /**
     * Revision chips, when this is a second attempt. A closed set: what the
     * customer WROTE never reaches a prompt, only a person.
     * docs/spec-pipeline.md section 6.
     */
    reasons?: RevisionReason[];
  }): Promise<{
    portraitBytes: Uint8Array;
    /**
     * Which prompt wording drew it (images/prompts.ts PROMPT_VERSION, or "mock"
     * offline). Stored on the artwork so a later shift in quality can be traced
     * back to the words that caused it.
     */
    promptVersion: string;
  }>;
}
