/**
 * The seam between the customizer and whatever draws the portraits. Everything
 * upstream (routes, UI, DB) speaks only to this interface, so the mock and the
 * real OpenAI provider are drop-in interchangeable and the whole flow runs
 * locally with no API keys.
 */

import type { RevisionReason } from "@/lib/revision";
import type { PortraitSide } from "./prompts";

export type { PortraitSide };

/**
 * The style an artwork was drawn in.
 *
 * THERE IS ONE HOUSE STYLE NOW (owner decision, 3 August). The customer is not
 * asked, the picker is gone, and nothing new writes this. It survives only
 * because `artworks.style` still holds it for portraits drawn before the
 * change, and the account page labels a creature's thumbnail from it. New rows
 * leave it null, which that label already renders as "Your portrait".
 *
 * Do not reintroduce this as a choice without reading docs/spec-portrait-
 * prompting.md: the two prompts are now the two SIDES of the garment, and a
 * style axis on top of that multiplies the prompt matrix rather than extending
 * it.
 */
export type ArtStyle = "classic-portrait" | "line-sketch" | "watercolor";

/** Labels for portraits drawn before the range settled on one house style. */
export const ART_STYLE_LABELS: Record<ArtStyle, string> = {
  "classic-portrait": "Classic portrait",
  "line-sketch": "Line sketch",
  watercolor: "Watercolor",
};

export function isArtStyle(value: unknown): value is ArtStyle {
  return (
    typeof value === "string" && value in ART_STYLE_LABELS
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
    /**
     * Which side of the garment this portrait is for, which decides both the
     * medium and the pose: the front is colour and faces the viewer, the back
     * is graphite and is a strict side profile. This replaced the customer's
     * style choice; see the note on ArtStyle above.
     */
    side: PortraitSide;
    /**
     * Revision chips, when this is a second attempt. A closed set: what the
     * customer WROTE never reaches a prompt, only a person.
     * docs/spec-pipeline.md section 6.
     */
    reasons?: RevisionReason[];
    /**
     * Storage key of the breed's hand-reviewed side-profile reference, used as
     * a SECOND input for the back portrait. Null or missing is an ordinary
     * case, not an error: One of One entries have no reference by design, and
     * the library is drawn breed by breed. Fall back to the photograph alone.
     */
    referenceKey?: string | null;
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
